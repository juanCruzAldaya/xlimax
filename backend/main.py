"""
XLIMAX — Backend de ingestión de datos
ESP32 → POST /readings → FastAPI + Firestore

Ejecutar:
    uvicorn main:app --reload --port 8000

Endpoint principal del ESP32:
    POST http://<server-ip>:8000/readings
"""

import os
import json
import base64
import tempfile
from datetime import datetime, timezone
from typing import List
import firebase_admin
from firebase_admin import credentials, firestore

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from dotenv import load_dotenv
load_dotenv()

import tinytuya

from models import ReadingPayload, ReadingResponse

# --- Tuya ---
TUYA_CHANNELS = {
    "switch_1": "Luces",
    "switch_2": "Extractor",
    "switch_3": "Ventilador",
}

def _tuya_cloud():
    return tinytuya.Cloud(
        apiRegion=os.getenv("TUYA_REGION", "us"),
        apiKey=os.environ["TUYA_ACCESS_ID"],
        apiSecret=os.environ["TUYA_ACCESS_SECRET"],
        apiDeviceID=os.environ["TUYA_DEVICE_ID"],
    )

TUYA_DEVICE_ID = os.getenv("TUYA_DEVICE_ID", "")

# Firebase init
# Prioridad:
#   1. FIREBASE_KEY_B64  — contenido del JSON en base64 (Render / cloud)
#   2. firebase-key.json — archivo local (desarrollo)
def _init_firebase():
    b64 = os.environ.get("FIREBASE_KEY_B64")
    if b64:
        key_dict = json.loads(base64.b64decode(b64).decode("utf-8"))
        cred = credentials.Certificate(key_dict)
        print("[OK] Firebase via env var")
        return cred

    key_path = os.path.join(os.path.dirname(__file__), "..", "firebase-key.json")
    if os.path.exists(key_path):
        print("[OK] Firebase via archivo local")
        return credentials.Certificate(key_path)

    raise FileNotFoundError("No se encontro credencial Firebase")

try:
    firebase_admin.initialize_app(_init_firebase())
    db = firestore.client()
    print("[OK] Firestore listo")
except Exception as e:
    print(f"[WARN] Firebase no disponible: {e}")
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

# buffer de logs del ESP32
_logs: List[dict] = []
MAX_LOGS = 500


@app.get("/", include_in_schema=False)
def root():
    return {"service": "xlimax-api", "status": "ok"}


@app.post(
    "/readings",
    response_model=ReadingResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Ingestión de lecturas del ESP32 — todos los sensores en un POST",
)
def ingest_reading(payload: ReadingPayload) -> ReadingResponse:
    """
    Un solo POST por intervalo con todos los sensores.

    ```json
    {
      "device_id": "esp32-agustina",
      "firmware_version": "1.4.0",
      "sensors": {
        "interior": { "temperature": 21.5, "humidity": 65.2, "light": 1200, "pressure_hpa": 1013.5, "altitude_m": 20.0 },
        "exterior": { "temperature": 18.3, "humidity": 78.1, "light": 0.0 }
      }
    }
    ```
    """
    now          = datetime.now(timezone.utc)
    effective_ts = payload.timestamp or now

    record = {
        "device_id":   payload.device_id,
        "ts":          effective_ts,
        "received_at": now,
        "fw":          payload.firmware_version,
        "sensors": {
            name: {k: v for k, v in {
                "temperature":  s.temperature,
                "humidity":     s.humidity,
                "light":        s.light,
                "pressure_hpa": s.pressure_hpa,
                "altitude_m":   s.altitude_m,
            }.items() if v is not None}
            for name, s in payload.sensors.items()
        }
    }

    if db:
        try:
            db.collection("readings").add(record)
            sensors_str = ", ".join(
                f"{n} T:{s.temperature}C H:{s.humidity}%"
                for n, s in payload.sensors.items()
            )
            print(f"[OK] Firestore: {payload.device_id} [{sensors_str}]")
        except Exception as e:
            print(f"[ERR] Firestore: {e}")
            _buffer.append(record)
    else:
        _buffer.append(record)
        print(f"[BUFFER] {payload.device_id}")

    if len(_buffer) > MAX_BUFFER:
        _buffer.pop(0)

    return ReadingResponse(
        status="ok",
        received_at=now,
        device_id=payload.device_id,
        sensors_ok=len(payload.sensors),
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


@app.post(
    "/log",
    status_code=201,
    summary="Log remoto del ESP32",
)
def receive_log(entry: dict):
    """
    El ESP32 manda sus mensajes de debug/error acá.
    Body: { "device_id": "...", "level": "INFO|WARN|ERROR", "message": "..." }
    """
    now = datetime.now(timezone.utc)
    record = {
        "ts":        now.isoformat(),
        "device_id": entry.get("device_id", "unknown"),
        "level":     entry.get("level", "INFO").upper(),
        "message":   entry.get("message", ""),
    }
    _logs.append(record)
    if len(_logs) > MAX_LOGS:
        _logs.pop(0)
    print(f"[LOG][{record['level']}] {record['device_id']}: {record['message']}")
    return {"ok": True}


@app.get(
    "/log",
    summary="Últimos logs del ESP32",
)
def get_logs(device_id: str = None, limit: int = 100):
    logs = _logs[-limit:]
    if device_id:
        logs = [l for l in logs if l["device_id"] == device_id]
    return {"count": len(logs), "logs": list(reversed(logs))}


class TuyaCommand(BaseModel):
    channel: str   # "switch_1" | "switch_2" | "switch_3"
    value:   bool


@app.get("/tuya/status", summary="Estado actual de los 3 canales Tuya")
def tuya_status():
    try:
        cloud = _tuya_cloud()
        resp  = cloud.getstatus(TUYA_DEVICE_ID)
        raw   = resp.get("result", [])
        state = {
            item["code"]: item["value"]
            for item in raw
            if item["code"] in TUYA_CHANNELS
        }
        return {
            "ok":     True,
            "state":  state,
            "labels": TUYA_CHANNELS,
        }
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@app.post("/tuya/control", summary="Encender / apagar un canal Tuya")
def tuya_control(cmd: TuyaCommand):
    if cmd.channel not in TUYA_CHANNELS:
        raise HTTPException(status_code=400, detail=f"Canal inválido: {cmd.channel}")
    try:
        cloud = _tuya_cloud()
        cloud.sendcommand(TUYA_DEVICE_ID, {
            "commands": [{"code": cmd.channel, "value": cmd.value}]
        })
        return {"ok": True, "channel": cmd.channel, "value": cmd.value}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


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
