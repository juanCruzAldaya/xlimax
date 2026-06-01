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

VERSION       = "1.3.0"
FIRMWARE_BASE = "https://raw.githubusercontent.com/juanCruzAldaya/xlimax/master/firmware"

# IDs de cada sensor
DEVICE_1 = "esp32-agustina-01"
DEVICE_2 = "esp32-agustina-02"

# --- I2C — dos buses independientes ---
HTU21D_ADDR = 0x40
TEMP_CMD    = 0xF3
HUM_CMD     = 0xF5

i2c1 = I2C(0, scl=Pin(22), sda=Pin(21), freq=100000)
i2c2 = I2C(1, scl=Pin(25), sda=Pin(26), freq=100000)

# --- ADC (LDR principal GPIO34) ---
ldr = ADC(Pin(34))
ldr.atten(ADC.ATTN_11DB)
ldr.width(ADC.WIDTH_12BIT)

# --- ADC (LDR secundario GPIO35) ---
ldr2 = ADC(Pin(35))
ldr2.atten(ADC.ATTN_11DB)
ldr2.width(ADC.WIDTH_12BIT)

# --- Constantes para cálculo de lux (ajustables según LDR) ---
K     = 12.0
n     = 1.4
VCC   = 3.3
ADC_MAX = 4095.0

# --- Logger remoto ---
def log(level, msg):
    print(f"[{level}] {msg}")
    try:
        urequests.post(
            f"{BACKEND_URL}/log",
            json={"device_id": DEVICE_1, "level": level, "message": msg},
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

# --- OTA update ---
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

# --- Sensor HTU21D ---
def read_htu21d(bus, nombre):
    try:
        bus.writeto(HTU21D_ADDR, bytes([TEMP_CMD]))
        time.sleep(0.05)
        temp_raw = bus.readfrom(HTU21D_ADDR, 3)
        temp = ((temp_raw[0] << 8) | temp_raw[1]) & 0xFFFC
        temp_c = -46.85 + 175.72 * (temp / 65536.0)

        bus.writeto(HTU21D_ADDR, bytes([HUM_CMD]))
        time.sleep(0.05)
        hum_raw = bus.readfrom(HTU21D_ADDR, 3)
        hum = ((hum_raw[0] << 8) | hum_raw[1]) & 0xFFFC
        hum_pct = -6.0 + 125.0 * (hum / 65536.0)

        return round(temp_c, 2), round(hum_pct, 2)
    except Exception as e:
        error(f"HTU21D {nombre}: {e}")
        return None, None

# --- Sensor BMP280 ---
class BMP280:
    def __init__(self, i2c, addr=0x76):   # FIX: __init__ no _init_
        self.i2c  = i2c
        self.addr = addr
        try:
            self.i2c.readfrom_mem(self.addr, 0xD0, 1)
        except Exception:
            raise OSError("BMP280 no encontrado")
        self._read_calibration()
        self.i2c.writeto_mem(self.addr, 0xF4, bytes([0x27]))
        self.i2c.writeto_mem(self.addr, 0xF5, bytes([0xA0]))

    def _read_calibration(self):
        calib = self.i2c.readfrom_mem(self.addr, 0x88, 24)
        vals = struct.unpack('<HhhHhhhhhhhh', calib)
        self.dig_T1 = vals[0]
        self.dig_T2 = vals[1]
        self.dig_T3 = vals[2]
        self.dig_P1 = vals[3]
        self.dig_P2 = vals[4]
        self.dig_P3 = vals[5]
        self.dig_P4 = vals[6]
        self.dig_P5 = vals[7]
        self.dig_P6 = vals[8]
        self.dig_P7 = vals[9]
        self.dig_P8 = vals[10]
        self.dig_P9 = vals[11]

    def read_raw(self):
        data = self.i2c.readfrom_mem(self.addr, 0xF7, 6)
        adc_p = (data[0] << 12) | (data[1] << 4) | (data[2] >> 4)
        adc_t = (data[3] << 12) | (data[4] << 4) | (data[5] >> 4)
        return adc_t, adc_p

    def compensate(self, adc_t, adc_p):
        var1 = (((adc_t >> 3) - (self.dig_T1 << 1)) * self.dig_T2) >> 11
        var2 = (((((adc_t >> 4) - self.dig_T1) * ((adc_t >> 4) - self.dig_T1)) >> 12) * self.dig_T3) >> 14
        t_fine = var1 + var2
        temp_c = ((t_fine * 5 + 128) >> 8) / 100.0

        var1 = t_fine - 128000
        var2 = var1 * var1 * self.dig_P6
        var2 = var2 + ((var1 * self.dig_P5) << 17)
        var2 = var2 + (self.dig_P4 << 35)
        var1 = ((var1 * var1 * self.dig_P3) >> 8) + ((var1 * self.dig_P2) << 12)
        var1 = (((1 << 47) + var1) * self.dig_P1) >> 33
        if var1 == 0:
            return temp_c, None
        p = 1048576 - adc_p
        p = int((((p << 31) - var2) * 3125) / var1)
        var1 = (self.dig_P9 * (p >> 13) * (p >> 13)) >> 25
        var2 = (self.dig_P8 * p) >> 19
        p = ((p + var1 + var2) >> 8) + (self.dig_P7 << 4)
        return temp_c, round(p / 25600.0, 2)

    def read(self):
        return self.compensate(*self.read_raw())

# --- Inicializar BMP280 en i2c1 ---
bmp1 = None
for addr in (0x76, 0x77):
    try:
        bmp1 = BMP280(i2c1, addr=addr)
        info(f"BMP280(1) OK en 0x{addr:02X}")
        break
    except Exception as e:
        warn(f"No BMP280 en i2c1 0x{addr:02X}: {e}")
if bmp1 is None:
    warn("BMP280(1) no disponible")

# --- Inicializar BMP280 en i2c2 ---
bmp2 = None
for addr in (0x76, 0x77):
    try:
        bmp2 = BMP280(i2c2, addr=addr)
        info(f"BMP280(2) OK en i2c2 0x{addr:02X}")
        break
    except Exception as e:
        warn(f"No BMP280 en i2c2 0x{addr:02X}: {e}")
if bmp2 is None:
    warn("BMP280(2) no disponible")

# --- LDR: calcula lux desde ADC raw ---
def calc_lux_from_adc(raw_adc):
    raw_adc = max(0.0, min(ADC_MAX, raw_adc))
    voltage = (raw_adc / ADC_MAX) * VCC
    ratio   = max(voltage / VCC, 0.000001)
    return round(K * (ratio ** (-n)), 2), round(voltage, 3), int(raw_adc)

def read_light():
    try:
        return calc_lux_from_adc(ldr.read())
    except Exception as e:
        error(f"LDR: {e}")
        return 0.0, 0.0, 0

def read_light_2():
    try:
        return calc_lux_from_adc(ldr2.read())
    except Exception as e:
        error(f"LDR2: {e}")
        return 0.0, 0.0, 0

# --- Presión → altitud ---
def pressure_to_altitude(pressure_hpa, sea_level_hpa=1013.25):
    try:
        return round(44330.0 * (1.0 - (pressure_hpa / sea_level_hpa) ** (1 / 5.255)), 2)
    except:
        return None

# --- Leer BMP280 con manejo de error ---
def read_bmp(bmp, nombre):
    if bmp is None:
        return None, None
    try:
        _, pressure = bmp.read()
        altitude = pressure_to_altitude(pressure) if pressure else None
        return pressure, altitude
    except Exception as e:
        warn(f"BMP280({nombre}) lectura: {e}")
        return None, None

# --- Envio ---
def send_reading(device_id, temp, hum, lux=0.0, pressure=None, altitude=None):
    try:
        resp = urequests.post(
            f"{BACKEND_URL}/readings",
            json={
                "device_id": device_id,
                "readings": {
                    "temperature":  temp,
                    "humidity":     hum,
                    "light":        lux,
                    "pressure_hpa": pressure,
                    "altitude_m":   altitude,
                },
                "firmware_version": VERSION
            },
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        info(f"{device_id} POST {resp.status_code} T:{temp}C H:{hum}% L:{lux} P:{pressure}hPa A:{altitude}m")
        resp.close()
    except Exception as e:
        error(f"POST {device_id}: {e}")

# --- MAIN ---
info(f"Iniciando XLIMAX v{VERSION}")

if not connect_wifi():
    warn("Sin WiFi al inicio — reintentando en el loop")
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

        lux1, v1, raw1 = read_light()
        lux2, v2, raw2 = read_light_2()

        t1, h1 = read_htu21d(i2c1, "sensor1")
        p1, a1 = read_bmp(bmp1, "1")
        if t1 is not None:
            send_reading(DEVICE_1, t1, h1, lux1, p1, a1)
        else:
            warn("Sensor 1 sin lectura")

        time.sleep(0.5)

        t2, h2 = read_htu21d(i2c2, "sensor2")
        p2, a2 = read_bmp(bmp2, "2")
        if t2 is not None:
            send_reading(DEVICE_2, t2, h2, lux2, p2, a2)
        else:
            warn("Sensor 2 sin lectura")

        info(f"D1 -> T:{t1}C H:{h1}% L:{lux1} V:{v1}V RAW:{raw1} P:{p1}hPa A:{a1}m")
        info(f"D2 -> T:{t2}C H:{h2}% L:{lux2} V:{v2}V RAW:{raw2} P:{p2}hPa A:{a2}m")

    time.sleep(1)
