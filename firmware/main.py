import machine
import time
import network
import urequests
from machine import ADC, Pin

# --- CONFIG ---
SSID        = "Antil "
PASSWORD    = "agustina2025"
BACKEND_URL = "https://xlimax.onrender.com"
DEVICE_ID   = "esp32-agustina-01"
INTERVAL    = 60  # segundos

# --- I2C (HTU21D — temp y humedad) ---
i2c         = machine.I2C(scl=machine.Pin(22), sda=machine.Pin(21))
HTU21D_ADDR = 0x40
TEMP_CMD    = 0xF3
HUM_CMD     = 0xF5

# --- ADC (LDR — luz) ---
ldr = ADC(Pin(34))
ldr.atten(ADC.ATTN_11DB)  # rango completo 0-3.3V

# --- Logger remoto ---
def log(level, msg):
    print(f"[{level}] {msg}")
    try:
        urequests.post(
            f"{BACKEND_URL}/log",
            json={"device_id": DEVICE_ID, "level": level, "message": msg},
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

# --- Sensores ---
def read_sensor():
    try:
        i2c.writeto(HTU21D_ADDR, bytes([TEMP_CMD]))
        time.sleep(0.05)
        temp_raw = i2c.readfrom(HTU21D_ADDR, 3)
        temp = ((temp_raw[0] << 8) | temp_raw[1]) & 0xFFFC
        temp_c = -46.85 + 175.72 * (temp / 65536.0)

        i2c.writeto(HTU21D_ADDR, bytes([HUM_CMD]))
        time.sleep(0.05)
        hum_raw = i2c.readfrom(HTU21D_ADDR, 3)
        hum = ((hum_raw[0] << 8) | hum_raw[1]) & 0xFFFC
        hum_pct = -6.0 + 125.0 * (hum / 65536.0)

        return round(temp_c, 2), round(hum_pct, 2)
    except Exception as e:
        error(f"HTU21D: {e}")
        return None, None

def read_light():
    try:
        val = ldr.read()       # 0 (oscuro) a 4095 (brillante)
        return float(4095 - val)   # invertido: mas luz = numero mayor
    except Exception as e:
        error(f"LDR: {e}")
        return 0.0

# --- Envio ---
def send_reading(temp, hum):
    lux = read_light()
    try:
        resp = urequests.post(
            f"{BACKEND_URL}/readings",
            json={
                "device_id": DEVICE_ID,
                "readings": {
                    "temperature": temp,
                    "humidity":    hum,
                    "light":       lux
                },
                "firmware_version": "1.1.0"
            },
            headers={"Content-Type": "application/json"}
        )
        info(f"POST {resp.status_code} | T:{temp}C H:{hum}% L:{lux}")
        resp.close()
    except Exception as e:
        error(f"POST: {e}")

# --- MAIN ---
info("Iniciando XLIMAX v1.1.0")
connect_wifi()

last_send = 0
while True:
    now = time.time()
    if now - last_send >= INTERVAL:
        last_send = now
        if not connect_wifi():
            time.sleep(5)
            continue
        temp, hum = read_sensor()
        if temp is not None:
            send_reading(temp, hum)
        else:
            warn("Lectura invalida, saltando ciclo")
    time.sleep(1)
