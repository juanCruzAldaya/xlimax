import machine
import time
import network
import urequests
from machine import ADC, Pin

# --- CONFIG ---
SSID        = "Antil "
PASSWORD    = "agustina2025"
BACKEND_URL = "https://xlimax.onrender.com"
INTERVAL    = 60  # segundos

# IDs de cada sensor — aparecen como dispositivos separados en el dashboard
DEVICE_1 = "esp32-agustina-01"   # sensor interior
DEVICE_2 = "esp32-agustina-02"   # sensor exterior

# --- I2C — dos buses independientes ---
HTU21D_ADDR = 0x40
TEMP_CMD    = 0xF3
HUM_CMD     = 0xF5

i2c1 = machine.I2C(0, scl=machine.Pin(22), sda=machine.Pin(21))  # sensor 1
i2c2 = machine.I2C(1, scl=machine.Pin(25), sda=machine.Pin(26))  # sensor 2

# --- ADC (LDR — luz, solo en sensor 1) ---
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
            info(f"WiFi OK. IP: {wlan.ifconfig()[0]}")
            return True
        time.sleep(0.5)
    error("WiFi FAIL")
    return False

# --- Sensor HTU21D generico (recibe el bus i2c) ---
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

# --- LDR ---
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
                "readings": {
                    "temperature": temp,
                    "humidity":    hum,
                    "light":       lux
                },
                "firmware_version": "1.2.0"
            },
            headers={"Content-Type": "application/json"}
        )
        info(f"{device_id} POST {resp.status_code} T:{temp}C H:{hum}%")
        resp.close()
    except Exception as e:
        error(f"POST {device_id}: {e}")

# --- MAIN ---
info("Iniciando XLIMAX v1.2.0 - 2 sensores")
connect_wifi()

last_send = 0
while True:
    now = time.time()
    if now - last_send >= INTERVAL:
        last_send = now

        if not connect_wifi():
            time.sleep(5)
            continue

        lux = read_light()

        # Sensor 1
        t1, h1 = read_htu21d(i2c1, "sensor1")
        if t1 is not None:
            send_reading(DEVICE_1, t1, h1, lux)
        else:
            warn("Sensor 1 sin lectura")

        time.sleep(0.5)

        # Sensor 2
        t2, h2 = read_htu21d(i2c2, "sensor2")
        if t2 is not None:
            send_reading(DEVICE_2, t2, h2, 0.0)
        else:
            warn("Sensor 2 sin lectura")

    time.sleep(1)
