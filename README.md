# XLIMAX — Monitor Ambiental ESP32

Sistema de monitoreo ambiental con sensores de temperatura, humedad y luminosidad conectados vía WiFi a un backend FastAPI, con dashboard de analytics en React.

**Ubicación de referencia:** Junín, Buenos Aires, Argentina (UTC-3, ART)

---

## Stack

| Capa      | Tecnología                                        |
|-----------|---------------------------------------------------|
| Hardware  | ESP32 + DHT22 + BH1750 + módulo relay 4 canales   |
| Firmware  | MicroPython                                       |
| Base datos| Firebase Firestore (Spark plan — gratuito)        |
| Frontend  | React 18 · Vite · Recharts · Firebase SDK         |
| Hosting   | Firebase Hosting + GitHub Actions CI/CD           |
| Backend   | No requerido (ESP32 escribe directo a Firestore)  |

---

## Estructura del proyecto

```
xlimax/
├── firebase.json                      ← Firebase Hosting config
├── firestore.rules                    ← reglas de seguridad Firestore
├── firestore.indexes.json
├── .github/workflows/deploy.yml       ← CI/CD: build + deploy automático en push a master
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       ├── firebase.js                ← inicialización Firebase SDK
│       ├── main.jsx
│       ├── App.jsx
│       ├── App.css
│       ├── styles/
│       │   └── variables.css          ← design tokens (colores, tipografía, espaciado)
│       ├── data/
│       │   └── mockData.js            ← 864 lecturas mock (3 días, cada 5 min)
│       ├── services/
│       │   ├── firestore.js           ← lecturas de sensores (subscribe / fetch)
│       │   └── deviceControl.js       ← control de actuadores (toggle, allOff)
│       ├── hooks/
│       │   ├── useReadings.js         ← auto-switch Firestore ↔ mock data
│       │   └── useDeviceState.js      ← estado en tiempo real del dispositivo
│       └── components/
│           ├── Header.jsx             ← logo, device ID, badge LIVE/MOCK
│           ├── Sidebar.jsx            ← navegación
│           ├── SensorCard.jsx         ← valor actual + sparkline + min/max/prom
│           ├── ChartPanel.jsx         ← AreaChart con selector de rango temporal
│           ├── StatsPanel.jsx         ← estadísticas y comparativo por día
│           ├── ControlPanel.jsx       ← toggles de actuadores (luz, fan, bomba, aux)
│           └── AutomationPanel.jsx    ← reglas de automatización + log de actividad
└── backend/                           ← opcional, no requerido en arquitectura actual
    ├── main.py
    ├── models.py
    └── requirements.txt
```

---

## Levantar el proyecto

### Frontend

```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
# → http://localhost:8000
# → Swagger UI: http://localhost:8000/docs
```

---

## API — Contrato ESP32 → Backend

### `POST /readings`

El ESP32 llama a este endpoint cada 5 minutos vía WiFi (HTTP POST sobre la red local).

**Request body:**
```json
{
  "device_id": "esp32-juanin-01",
  "timestamp": "2026-05-21T15:30:00Z",
  "readings": {
    "temperature": 15.2,
    "humidity": 68.4,
    "light": 4200.0
  },
  "firmware_version": "1.0.0"
}
```

| Campo              | Tipo    | Requerido | Descripción                                      |
|--------------------|---------|-----------|--------------------------------------------------|
| `device_id`        | string  | ✓         | ID único del ESP32                               |
| `timestamp`        | ISO8601 | —         | Si el ESP tiene RTC; si no, el server usa `now`  |
| `readings.temperature` | float | ✓      | °C, rango -40 a 85                              |
| `readings.humidity`    | float | ✓      | %, rango 0 a 100                                |
| `readings.light`       | float | ✓      | Lux, ≥ 0                                        |
| `firmware_version` | string  | —         | Versión del firmware ESP32                       |

**Response `201`:**
```json
{
  "status": "ok",
  "received_at": "2026-05-21T15:30:00.123Z",
  "device_id": "esp32-juanin-01"
}
```

### `GET /readings?limit=100`
Últimas lecturas en buffer (modo debug, sin persistencia aún).

### `GET /devices/{device_id}/latest`
Última lectura registrada de un dispositivo.

---

## Firmware ESP32 — MicroPython

El ESP32 corre MicroPython. Se configura conectando por USB y copiando los archivos `.py`.

### Flujo de datos

```
ESP32 lee sensores cada 5 min → POST a Firestore /readings/{auto-id}
ESP32 hace polling a Firestore /devices/esp32-juanin-01 cada 3 s → activa relays
```

### Pseudocódigo `main.py`

```python
import urequests, ujson, time, network
from machine import Pin

WIFI_SSID     = "tu-red"
WIFI_PASSWORD = "tu-clave"
API_KEY       = "AIzaSyD6KRCSFTlHxwuXrQwpJ_Vah5jIIFBlSIw"
PROJECT_ID    = "xlimax-c8bb4"
DEVICE_ID     = "esp32-juanin-01"
BASE_URL      = f"https://firestore.googleapis.com/v1/projects/{PROJECT_ID}/databases/(default)/documents"

# Pines GPIO → relay
PINS = {
    'light': Pin(26, Pin.OUT),
    'fan':   Pin(27, Pin.OUT),
    'pump':  Pin(14, Pin.OUT),
    'aux':   Pin(12, Pin.OUT),
}

# Relay de 5V activo-LOW: LOW = encendido, HIGH = apagado
def set_relay(pin, state):
    pin.value(0 if state else 1)

def post_reading(temp, hum, lux):
    body = ujson.dumps({"fields": {
        "t":        {"doubleValue": temp},
        "h":        {"doubleValue": hum},
        "l":        {"doubleValue": lux},
        "deviceId": {"stringValue": DEVICE_ID},
    }})
    url = f"{BASE_URL}/readings?key={API_KEY}"
    r = urequests.post(url, data=body, headers={"Content-Type": "application/json"})
    r.close()

def get_device_state():
    url = f"{BASE_URL}/devices/{DEVICE_ID}?key={API_KEY}"
    r = urequests.get(url, timeout=5)
    doc = r.json()
    r.close()
    fields = doc.get("fields", {})
    return {k: fields[k]["booleanValue"] for k in PINS if k in fields}

last_reading = 0

while True:
    try:
        # Control de actuadores — polling cada 3 s
        state = get_device_state()
        for key, pin in PINS.items():
            set_relay(pin, state.get(key, False))

        # Lectura de sensores — cada 5 min
        if time.time() - last_reading >= 300:
            temp = dht.temperature()   # DHT22
            hum  = dht.humidity()
            lux  = bh1750.luminance()  # BH1750
            post_reading(temp, hum, lux)
            last_reading = time.time()

    except Exception as e:
        print("Error:", e)

    time.sleep(3)
```

---

## Hardware — Control de actuadores

El relay es el componente que conecta el ESP32 (3.3V) con dispositivos de mayor potencia (220V AC o 12V DC). El ESP32 nunca toca el voltaje alto.

### Módulo relay 4 canales (recomendado)

Un solo módulo controla los 4 actuadores: luz, ventilador, bomba y auxiliar.

```
Módulo relay 4ch          ESP32
─────────────────         ──────────────
VCC    ──────────────→    VIN (5V)
GND    ──────────────→    GND
IN1    ──────────────→    GPIO 26  → Luz / iluminación
IN2    ──────────────→    GPIO 27  → Ventilador / extractor
IN3    ──────────────→    GPIO 14  → Bomba de riego
IN4    ──────────────→    GPIO 12  → Auxiliar
```

### Conexión de carga (por cada canal)

```
Fase 220V ──→ Relay COM
              Relay NO  ──→ Dispositivo (lámpara, bomba, etc.) ──→ Neutro
```

> Los relays de 5V suelen ser **activo-LOW**: `LOW = encendido`, `HIGH = apagado`.
> Verificar el datasheet del módulo específico.

### Flujo app → dispositivo físico

```
1. Toggle en dashboard           ~0 ms
2. App escribe a Firestore       ~100 ms
3. ESP32 hace polling (max 3 s)  ~0–3000 ms
4. ESP32 activa GPIO             ~1 ms
5. Relay cierra circuito         ~5 ms
────────────────────────────────────────
   Latencia total:               < 4 segundos
```

---

## Mock data

El archivo `frontend/src/data/mockData.js` genera 864 lecturas deterministas
(sin Math.random — usa armónicos de seno) simulando 3 días típicos de mayo
en Junín, Buenos Aires:

| Día          | Clima                | Temp (°C) | Humedad (%) | Lux pico |
|--------------|----------------------|-----------|-------------|----------|
| Dom 18/05    | Parcialmente nublado | 7.2–14.1  | 62–78       | 11 000   |
| Lun 19/05    | Lluvioso             | 6.8–11.0  | 78–92       | 3 800    |
| Mar 20/05    | Despejado            | 5.6–16.5  | 52–72       | 22 000   |

- **Temperatura:** ciclo sinusoidal, mínimo a las 06:00, máximo a las 15:00
- **Humedad:** correlación inversa con temperatura + bias por tipo de día
- **Luz:** curva de campana entre amanecer (07:30) y atardecer (18:00)

---

## Dashboard — vistas

### Overview
- 3 tarjetas de sensores: valor actual, sparkline de la última hora, min/max/prom del rango
- Chart completo del sensor seleccionado con selector de rango `[1h | 6h | 24h | 3d]`
- Panel de estadísticas: Mínimo · Máximo · Promedio · Desviación estándar

### Temperatura / Humedad / Luminosidad (detalle)
- Igual que Overview pero fijo en el sensor
- Estadísticas adicionales: comparativo por día con clima anotado

### Actuadores
- Toggles en tiempo real para: luz, ventilador, bomba de riego, auxiliar
- Estado sincronizado vía Firestore — cambios visibles en todos los clientes conectados
- Botón "Apagar todo" cuando hay actuadores activos
- Latencia app → dispositivo físico: < 4 segundos

### Automatización
- Reglas evaluadas en tiempo real contra la última lectura:
  - `temp < 8 °C` durante 30 min → calefactor
  - `hum > 85 %` → extractor
  - `lux < 2 000` entre 08:00–18:00 → panel LED grow
  - `hum > 90 %` durante 60 min → alerta
- Log de actividad histórica

---

## Diseño / CSS

Paleta dark navy con acentos por tipo de sensor:

| Token CSS        | Valor     | Uso                      |
|------------------|-----------|--------------------------|
| `--bg-base`      | `#080f1a` | Fondo raíz               |
| `--bg-card`      | `#112236` | Tarjetas                 |
| `--c-temp`       | `#f59e0b` | Temperatura (amber)      |
| `--c-humid`      | `#38bdf8` | Humedad (sky blue)       |
| `--c-light`      | `#a3e635` | Luminosidad (lime)       |
| `--c-auto`       | `#818cf8` | Automatización (indigo)  |
| `--font-mono`    | JetBrains Mono | Valores numéricos   |
| `--font-sans`    | Inter     | Labels y UI              |

---

## Próximos pasos

### Hardware (cuando llegue la placa)
- [ ] Flashear MicroPython en el ESP32
- [ ] Conectar DHT22 (temp + humedad) al protoboard
- [ ] Conectar BH1750 vía I²C (luz)
- [ ] Conectar módulo relay 4 canales (GPIO 26, 27, 14, 12)
- [ ] Escribir `main.py` completo con WiFi + sensores + control de relays
- [ ] Probar flujo completo: toggle en app → relay activa → dispositivo enciende

### Software
- [ ] Reglas de automatización ejecutadas server-side (Firebase Cloud Functions)
- [ ] Notificaciones por Telegram cuando se dispara una regla
- [ ] Exportación de datos históricos (CSV)
- [ ] Autenticación para el dashboard (Firebase Auth)
