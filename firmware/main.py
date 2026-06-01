import machine
import time
import network
import urequests
from machine import ADC, Pin, I2C
import struct

# --- CONFIG ---
SSID        = "Antil "
PASSWORD    = "agustina2025"
BACKEND_URL = "https://xlimax.onrender.com"
INTERVAL    = 45  # segundos entre lecturas

VERSION       = "1.4.0"
FIRMWARE_BASE = "https://raw.githubusercontent.com/juanCruzAldaya/xlimax/master/firmware"

DEVICE_ID = "esp32-agustina"   # ID de la placa — los sensores van adentro del JSON

# --- I2C — dos buses independientes ---
HTU21D_ADDR = 0x40
TEMP_CMD    = 0xF3
HUM_CMD     = 0xF5

i2c1 = I2C(0, scl=Pin(22), sda=Pin(21), freq=100000)
i2c2 = I2C(1, scl=Pin(25), sda=Pin(26), freq=100000)

# --- ADC LDRs ---
ldr  = ADC(Pin(34)); ldr.atten(ADC.ATTN_11DB);  ldr.width(ADC.WIDTH_12BIT)
ldr2 = ADC(Pin(35)); ldr2.atten(ADC.ATTN_11DB); ldr2.width(ADC.WIDTH_12BIT)

# --- Constantes lux ---
K = 12.0;  n = 1.4;  VCC = 3.3;  ADC_MAX = 4095.0

# --- Logger remoto ---
def log(level, msg):
    print(f"[{level}] {msg}")
    try:
        urequests.post(
            f"{BACKEND_URL}/log",
            json={"device_id": DEVICE_ID, "level": level, "message": msg},
            headers={"Content-Type": "application/json"},
            timeout=5
        ).close()
    except:
        pass

def info(msg):  log("INFO",  msg)
def warn(msg):  log("WARN",  msg)
def error(msg): log("ERROR", msg)

# --- WiFi ---
def connect_wifi():
    wlan = network.WLAN(network.STA_IF)
    wlan.active(True)
    if wlan.isconnected():
        return True
    info(f"Conectando a '{SSID}'...")
    wlan.connect(SSID, PASSWORD)
    for _ in range(20):
        if wlan.isconnected():
            info(f"WiFi OK — IP: {wlan.ifconfig()[0]}")
            return True
        time.sleep(0.5)
    error("WiFi FAIL")
    return False

# --- OTA ---
def check_update():
    try:
        info(f"OTA check (actual: v{VERSION})")
        r = urequests.get(f"{FIRMWARE_BASE}/version.txt", timeout=10)
        remote = r.text.strip()
        r.close()
        if remote == VERSION:
            info("Firmware al dia")
            return
        info(f"Nueva version: {remote} — descargando...")
        r = urequests.get(f"{FIRMWARE_BASE}/main.py", timeout=30)
        nuevo = r.text
        r.close()
        with open("main.py", "w") as f:
            f.write(nuevo)
        info(f"Firmware actualizado a v{remote} — reiniciando en 3s")
        time.sleep(3)
        machine.reset()
    except Exception as e:
        warn(f"OTA error: {e}")

# --- HTU21D ---
def read_htu21d(bus, nombre):
    try:
        bus.writeto(HTU21D_ADDR, bytes([TEMP_CMD]))
        time.sleep(0.05)
        raw = bus.readfrom(HTU21D_ADDR, 3)
        t = ((raw[0] << 8) | raw[1]) & 0xFFFC
        temp_c = -46.85 + 175.72 * (t / 65536.0)

        bus.writeto(HTU21D_ADDR, bytes([HUM_CMD]))
        time.sleep(0.05)
        raw = bus.readfrom(HTU21D_ADDR, 3)
        h = ((raw[0] << 8) | raw[1]) & 0xFFFC
        hum_pct = -6.0 + 125.0 * (h / 65536.0)

        return round(temp_c, 2), round(hum_pct, 2)
    except Exception as e:
        error(f"HTU21D {nombre}: {e}")
        return None, None

# --- BMP280 ---
class BMP280:
    def __init__(self, i2c, addr=0x76):
        self.i2c = i2c; self.addr = addr
        try:
            self.i2c.readfrom_mem(self.addr, 0xD0, 1)
        except:
            raise OSError("BMP280 no encontrado")
        self._calib()
        self.i2c.writeto_mem(self.addr, 0xF4, bytes([0x27]))
        self.i2c.writeto_mem(self.addr, 0xF5, bytes([0xA0]))

    def _calib(self):
        c = self.i2c.readfrom_mem(self.addr, 0x88, 24)
        v = struct.unpack('<HhhHhhhhhhhh', c)
        (self.T1, self.T2, self.T3,
         self.P1, self.P2, self.P3, self.P4,
         self.P5, self.P6, self.P7, self.P8, self.P9) = v

    def read(self):
        d = self.i2c.readfrom_mem(self.addr, 0xF7, 6)
        adc_p = (d[0] << 12) | (d[1] << 4) | (d[2] >> 4)
        adc_t = (d[3] << 12) | (d[4] << 4) | (d[5] >> 4)

        v1 = (((adc_t >> 3) - (self.T1 << 1)) * self.T2) >> 11
        v2 = (((((adc_t >> 4) - self.T1) ** 2) >> 12) * self.T3) >> 14
        tf = v1 + v2
        temp_c = ((tf * 5 + 128) >> 8) / 100.0

        v1 = tf - 128000
        v2 = v1 * v1 * self.P6 + ((v1 * self.P5) << 17) + (self.P4 << 35)
        v1 = ((v1 * v1 * self.P3) >> 8) + ((v1 * self.P2) << 12)
        v1 = (((1 << 47) + v1) * self.P1) >> 33
        if v1 == 0:
            return temp_c, None
        p = 1048576 - adc_p
        p = int((((p << 31) - v2) * 3125) / v1)
        p = ((p + (self.P9 * (p >> 13) ** 2 >> 25) + (self.P8 * p >> 19)) >> 8) + (self.P7 << 4)
        return temp_c, round(p / 25600.0, 2)

def init_bmp(bus, nombre):
    for addr in (0x76, 0x77):
        try:
            b = BMP280(bus, addr=addr)
            info(f"BMP280 {nombre} OK en 0x{addr:02X}")
            return b
        except:
            pass
    warn(f"BMP280 {nombre} no encontrado")
    return None

bmp1 = init_bmp(i2c1, "i2c1")
bmp2 = init_bmp(i2c2, "i2c2")

# --- LDR ---
def calc_lux(raw):
    raw = max(0.0, min(ADC_MAX, raw))
    ratio = max((raw / ADC_MAX), 0.000001)
    return round(K * (ratio ** (-n)), 2)

def read_ldr(adc_obj, nombre):
    try:
        return calc_lux(adc_obj.read())
    except Exception as e:
        error(f"{nombre}: {e}")
        return 0.0

# --- BMP ---
def read_bmp(bmp, nombre):
    if bmp is None:
        return None, None
    try:
        _, pressure = bmp.read()
        if pressure is None:
            return None, None
        altitude = round(44330.0 * (1.0 - (pressure / 1013.25) ** (1 / 5.255)), 2)
        return pressure, altitude
    except Exception as e:
        warn(f"BMP {nombre}: {e}")
        return None, None

# --- Envio — UN SOLO POST con todos los sensores ---
def send_all(sensors):
    """
    sensors = {
      "interior": {"temperature": t, "humidity": h, "light": l, ...},
      "exterior": {...},
    }
    """
    try:
        resp = urequests.post(
            f"{BACKEND_URL}/readings",
            json={
                "device_id":        DEVICE_ID,
                "firmware_version": VERSION,
                "sensors":          sensors,
            },
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        info(f"POST {resp.status_code} — {len(sensors)} sensores guardados")
        resp.close()
    except Exception as e:
        error(f"POST: {e}")

# --- MAIN ---
info(f"Iniciando XLIMAX v{VERSION}")

if not connect_wifi():
    warn("Sin WiFi al inicio")
else:
    check_update()

last_send   = 0
last_update = time.time()
UPDATE_INTERVAL = 60  # segundos entre chequeos OTA

while True:
    now = time.time()

    if now - last_update >= UPDATE_INTERVAL:
        last_update = now
        if connect_wifi():
            check_update()

    if now - last_send >= INTERVAL:
        last_send = now

        if not connect_wifi():
            time.sleep(5)
            continue

        sensors = {}

        # Sensor interior (i2c1)
        t1, h1 = read_htu21d(i2c1, "interior")
        p1, a1 = read_bmp(bmp1, "interior")
        if t1 is not None:
            entry = {"temperature": t1, "humidity": h1, "light": read_ldr(ldr, "LDR1")}
            if p1 is not None: entry["pressure_hpa"] = p1
            if a1 is not None: entry["altitude_m"]   = a1
            sensors["interior"] = entry

        # Sensor exterior (i2c2)
        t2, h2 = read_htu21d(i2c2, "exterior")
        p2, a2 = read_bmp(bmp2, "exterior")
        if t2 is not None:
            entry = {"temperature": t2, "humidity": h2, "light": read_ldr(ldr2, "LDR2")}
            if p2 is not None: entry["pressure_hpa"] = p2
            if a2 is not None: entry["altitude_m"]   = a2
            sensors["exterior"] = entry

        if sensors:
            send_all(sensors)
            info(f"interior: T:{t1}C H:{h1}% | exterior: T:{t2}C H:{h2}%")
        else:
            warn("Sin lecturas validas en este ciclo")

    time.sleep(1)
