import machine
import time
import network
import urequests
from machine import ADC, Pin

# --- CONFIG ---
SSID        = "Antil "
PASSWORD    = "agustina2025"
BACKEND_URL = "https://xlimax.onrender.com"
INTERVAL    = 30  # segundos entre lecturas

VERSION     = "1.2.0"
FIRMWARE_BASE = "https://raw.githubusercontent.com/juanCruzAldaya/xlimax/master/firmware"

# IDs de cada sensor
DEVICE_1 = "esp32-agustina-01"
DEVICE_2 = "esp32-agustina-02"

# --- I2C — dos buses independientes ---
HTU21D_ADDR = 0x40
TEMP_CMD    = 0xF3
HUM_CMD     = 0xF5

i2c1 = machine.I2C(0, scl=machine.Pin(22), sda=machine.Pin(21))
i2c2 = machine.I2C(1, scl=machine.Pin(25), sda=machine.Pin(26))

# --- ADC (LDR) ---
ldr = ADC(Pin(34))
ldr.atten(ADC.ATTN_11DB)

# --- Logger remoto ---
def log(level, msg):
    print(f"[{level}] {msg}")
    try:
        urequests.post(
            f"{BACKEND_URL}/log",
            json={"device_id": DEVICE_1, "level": level, "message": msg},
            headers={"Content-Type": "application/json"}
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

# --- Sensores ---
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

def read_light():
    try:
        return float(4095 - ldr.read())
    except Exception as e:
        error(f"LDR: {e}")
        return 0.0

# --- Envio ---
def send_reading(device_id, temp, hum, lux=0.0):
    try:
        resp = urequests.post(
            f"{BACKEND_URL}/readings",
            json={
                "device_id": device_id,
                "readings": {"temperature": temp, "humidity": hum, "light": lux},
                "firmware_version": VERSION
            },
            headers={"Content-Type": "application/json"}
        )
        info(f"{device_id} POST {resp.status_code} T:{temp}C H:{hum}%")
        resp.close()
    except Exception as e:
        error(f"POST {device_id}: {e}")

# --- MAIN ---
info(f"Iniciando XLIMAX v{VERSION}")

if not connect_wifi():
    warn("Sin WiFi al inicio — reintentando en el loop")
else:
    check_update()   # chequea actualizacion solo si hay WiFi

last_send   = 0
last_update = time.time()
UPDATE_INTERVAL = 6 * 60 * 60  # chequea OTA cada 6 horas

while True:
    now = time.time()

    # Chequeo periodico de OTA
    if now - last_update >= UPDATE_INTERVAL:
        last_update = now
        if connect_wifi():
            check_update()

    # Lectura y envio de sensores
    if now - last_send >= INTERVAL:
        last_send = now

        if not connect_wifi():
            time.sleep(5)
            continue

        lux = read_light()

        t1, h1 = read_htu21d(i2c1, "sensor1")
        if t1 is not None:
            send_reading(DEVICE_1, t1, h1, lux)
        else:
            warn("Sensor 1 sin lectura")

        time.sleep(0.5)

        t2, h2 = read_htu21d(i2c2, "sensor2")
        if t2 is not None:
            send_reading(DEVICE_2, t2, h2, 0.0)
        else:
            warn("Sensor 2 sin lectura")

    time.sleep(1)
