"""
XLIMAX — Backend de ingestión de datos
ESP32 → POST /readings → FastAPI

Ejecutar:
    uvicorn main:app --reload --port 8000

Endpoint principal del ESP32:
    POST http://<server-ip>:8000/readings
"""

from datetime import datetime, timezone
from typing import List

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware

from models import ReadingPayload, ReadingResponse

app = FastAPI(
    title="XLIMAX API",
    description="Ingestión de lecturas de sensores ESP32",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# buffer en memoria (hasta implementar BD)
_buffer: List[dict] = []
MAX_BUFFER = 1000


@app.get("/", include_in_schema=False)
def root():
    return {"service": "xlimax-api", "status": "ok"}


@app.post(
    "/readings",
    response_model=ReadingResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Ingestión de lectura del ESP32",
)
def ingest_reading(payload: ReadingPayload) -> ReadingResponse:
    """
    El ESP32 llama a este endpoint cada 5 minutos vía WiFi.

    Cuerpo esperado (application/json):
    ```json
    {
      "device_id": "esp32-juanin-01",
      "timestamp": "2026-05-21T15:30:00Z",   // opcional si tiene RTC
      "readings": {
        "temperature": 15.2,
        "humidity": 68.4,
        "light": 4200.0
      },
      "firmware_version": "1.0.0"
    }
    ```
    """
    now = datetime.now(timezone.utc)
    effective_ts = payload.timestamp or now

    record = {
        "device_id":   payload.device_id,
        "ts":          effective_ts.isoformat(),
        "received_at": now.isoformat(),
        "t":           payload.readings.temperature,
        "h":           payload.readings.humidity,
        "l":           payload.readings.light,
        "fw":          payload.firmware_version,
    }

    _buffer.append(record)
    if len(_buffer) > MAX_BUFFER:
        _buffer.pop(0)

    return ReadingResponse(
        status="ok",
        received_at=now,
        device_id=payload.device_id,
    )


@app.get(
    "/readings",
    summary="Últimas lecturas en buffer (debug)",
)
def get_readings(limit: int = 100):
    return {"count": len(_buffer), "data": _buffer[-limit:]}


@app.get(
    "/devices/{device_id}/latest",
    summary="Última lectura de un dispositivo",
)
def get_latest(device_id: str):
    matches = [r for r in reversed(_buffer) if r["device_id"] == device_id]
    if not matches:
        raise HTTPException(status_code=404, detail="Dispositivo sin lecturas registradas")
    return matches[0]
