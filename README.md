# XLIMAX — Monitor Ambiental ESP32

Sistema de monitoreo ambiental con sensores de temperatura, humedad y luminosidad conectados vía WiFi a un backend FastAPI, con dashboard de analytics en React.

**Ubicación de referencia:** Junín, Buenos Aires, Argentina (UTC-3, ART)

---

## Stack

| Capa       | Tecnología                              |
|------------|-----------------------------------------|
| Hardware   | ESP32 + DHT22 + BH1750                  |
| Backend    | Python 3.11 · FastAPI · Pydantic v2     |
| Frontend   | React 18 · Vite · Recharts              |
| Estilos    | CSS custom properties (dark navy)       |
| BD (próx.) | SQLite + SQLAlchemy                     |

---

## Estructura del proyecto

```
xlimax/
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── App.css
│       ├── styles/
│       │   └── variables.css          ← design tokens (colores, tipografía, espaciado)
│       ├── data/
│       │   └── mockData.js            ← 864 lecturas mock (3 días, cada 5 min)
│       └── components/
│           ├── Header.jsx             ← logo, device ID, última lectura
│           ├── Sidebar.jsx            ← navegación (Overview / sensores / Automatización)
│           ├── SensorCard.jsx         ← valor actual + sparkline + min/max/prom
│           ├── ChartPanel.jsx         ← AreaChart con selector de rango temporal
│           ├── StatsPanel.jsx         ← estadísticas y comparativo por día
│           └── AutomationPanel.jsx    ← reglas de automatización + log de actividad
└── backend/
    ├── main.py                        ← FastAPI app, endpoints de ingestión
    ├── models.py                      ← modelos Pydantic (payload ESP32 ↔ respuesta)
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

## Sketch ESP32 (pseudocódigo Arduino)

```cpp
// Intervalo de envío
const long INTERVAL = 5 * 60 * 1000; // 5 minutos en ms

void loop() {
  if (millis() - lastSend >= INTERVAL) {
    float temp = dht.readTemperature();
    float hum  = dht.readHumidity();
    float lux  = bh1750.readLightLevel();

    String body = "{\"device_id\":\"esp32-juanin-01\","
                  "\"readings\":{"
                    "\"temperature\":" + String(temp) + ","
                    "\"humidity\":"    + String(hum)  + ","
                    "\"light\":"       + String(lux)  + "}"
                  "}";

    HTTPClient http;
    http.begin("http://192.168.1.100:8000/readings");
    http.addHeader("Content-Type", "application/json");
    int code = http.POST(body);
    http.end();

    lastSend = millis();
  }
}
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

- [ ] Persistencia: SQLite + SQLAlchemy en backend
- [ ] Conectar frontend al backend real (reemplazar mock por fetch)
- [ ] Sketch Arduino completo para ESP32 (DHT22 + BH1750)
- [ ] Autenticación básica en la API (API key en header)
- [ ] WebSocket para actualización en tiempo real del dashboard
- [ ] Exportación de datos (CSV / JSON)
- [ ] Alertas por email/Telegram cuando se disparan reglas
