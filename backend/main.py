"""
XLIMAX — Backend de ingestión de datos
ESP32 → POST /readings → FastAPI + Firestore

Ejecutar:
    uvicorn main:app --reload --port 8000

Endpoint principal del ESP32:
    POST http://<server-ip>:8000/readings
"""

from datetime import datetime, timezone
from typing import List
import firebase_admin
from firebase_admin import credentials, firestore

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware

from models import ReadingPayload, ReadingResponse

# Firebase init
try:
    cred = credentials.Certificate("firebase-key.json")
    firebase_admin.initialize_app(cred)
    db = firestore.client()
except Exception as e:
    print(f"⚠️  Firebase error: {e}")
    db = None

app = FastAPI(
    title="XLIMAX API",
    description="Ingestión de lecturas de sensores ESP32",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# buffer fallback en memoria
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
    El ESP32 llama a este endpoint cada 60 segundos vía WiFi.

    Cuerpo esperado (application/json):
    ```json
    {
      "device_id": "esp32-agustina-01",
      "timestamp": "2026-05-21T15:30:00Z",   // opcional
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
        "ts":          effective_ts,
        "received_at": now,
        "temperature": payload.readings.temperature,
        "humidity":    payload.readings.humidity,
        "light":       payload.readings.light,
        "fw":          payload.firmware_version,
    }

    # Guardar en Firestore
    if db:
        try:
            db.collection("readings").add(record)
            print(f"✓ Firestore: {payload.device_id} — T:{payload.readings.temperature}°C H:{payload.readings.humidity}%")
        except Exception as e:
            print(f"✗ Firestore error: {e}")
            _buffer.append(record)
    else:
        _buffer.append(record)
        print(f"⚠️  Buffer: {payload.device_id} (Firestore unavailable)")

    if len(_buffer) > MAX_BUFFER:
        _buffer.pop(0)

    return ReadingResponse(
        status="ok",
        received_at=now,
        device_id=payload.device_id,
    )


@app.get(
    "/readings",
    summary="Últimas lecturas (Firestore)",
)
def get_readings(limit: int = 100):
    if not db:
        return {"count": len(_buffer), "data": _buffer[-limit:], "source": "buffer"}

    try:
        docs = db.collection("readings").order_by("received_at", direction=firestore.Query.DESCENDING).limit(limit).stream()
        data = []
        for doc in docs:
            record = doc.to_dict()
            record["id"] = doc.id
            data.append(record)
        return {"count": len(data), "data": data, "source": "firestore"}
    except Exception as e:
        return {"error": str(e), "data": _buffer[-limit:], "source": "buffer"}


@app.get(
    "/devices/{device_id}/latest",
    summary="Última lectura de un dispositivo",
)
def get_latest(device_id: str):
    if db:
        try:
            docs = db.collection("readings").where("device_id", "==", device_id).order_by("received_at", direction=firestore.Query.DESCENDING).limit(1).stream()
            for doc in docs:
                record = doc.to_dict()
                record["id"] = doc.id
                return record
            raise HTTPException(status_code=404, detail="Sin lecturas para este dispositivo")
        except Exception:
            pass

    matches = [r for r in reversed(_buffer) if r["device_id"] == device_id]
    if not matches:
        raise HTTPException(status_code=404, detail="Sin lecturas para este dispositivo")
    return matches[0]
