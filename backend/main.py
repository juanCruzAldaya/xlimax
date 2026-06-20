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
from datetime import datetime, timezone, timedelta
from typing import List
import firebase_admin
from firebase_admin import credentials, firestore

from fastapi import FastAPI, HTTPException, status, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from dotenv import load_dotenv
load_dotenv()

import tinytuya

from models import ReadingPayload, ReadingResponse

# --- Tuya ---
TUYA_CHANNELS = {
    "switch_1": "Extractor",
    "switch_2": "Luces",
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
            # Rollup horario para históricos (no debe romper la ingesta si falla)
            try:
                _rollup_hourly(record["sensors"], payload.device_id, effective_ts)
            except Exception as e:
                print(f"[WARN] rollup hourly: {e}")
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


@app.get("/readings/stats", summary="Conteo de registros en Firestore")
def readings_stats():
    """
    Devuelve conteos desde Firestore sin bajar los documentos completos.
    Usa count() aggregation para ser eficiente.
    """
    from datetime import timezone as tz
    now      = datetime.now(tz.utc)
    # Ayer 00:00 ART = ayer 03:00 UTC
    ayer_art = (now - timedelta(hours=now.hour, minutes=now.minute, seconds=now.second,
                                microseconds=now.microsecond)).replace(tzinfo=tz.utc)
    ayer_utc = ayer_art - timedelta(hours=3) - timedelta(days=1)

    if not db:
        return {"total": len(_buffer), "desde_ayer": 0, "source": "buffer"}

    try:
        total_result = db.collection("readings").count().get()
        total = total_result[0][0].value

        ayer_result = (
            db.collection("readings")
            .where("received_at", ">=", ayer_utc)
            .count().get()
        )
        desde_ayer = ayer_result[0][0].value

        return {
            "total":       total,
            "desde_ayer":  desde_ayer,
            "desde_utc":   ayer_utc.isoformat(),
            "source":      "firestore",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Sensores que se promedian en el downsampling (clave corta usada por el frontend)
_HISTORY_SENSORS = {
    "t": "temperature",
    "h": "humidity",
    "l": "light",
    "p": "pressure_hpa",
    "a": "altitude_m",
}


def _parse_iso(s: str) -> datetime:
    """ISO-8601 → datetime tz-aware (UTC). Acepta sufijo 'Z'."""
    dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def _bucket_start(ts: datetime, bucket: str) -> datetime:
    """Trunca un timestamp UTC al inicio de su bucket (hora o día)."""
    ts = ts.astimezone(timezone.utc)
    if bucket == "day":
        return ts.replace(hour=0, minute=0, second=0, microsecond=0)
    return ts.replace(minute=0, second=0, microsecond=0)


_ROLLUP_SENSORS = list(_HISTORY_SENSORS.items())  # [("t","temperature"), ...]
HOURLY_COL = "readings_hourly"


def _rollup_hourly(sensors: dict, device_id: str, ts: datetime) -> None:
    """
    Acumula sumas/conteos por hora en `readings_hourly` usando Increment
    (atómico, sin lectura previa). Permite históricos de rangos largos sin
    escanear miles de documentos crudos: el endpoint de histórico lee de acá.

    Doc id: "{device_id}_{YYYYMMDDHH}" (UTC). Estructura:
      { bucket_ts, device_id, count, nodes: { interior: {t_sum,t_n,...}, ... } }
    """
    if not db:
        return
    hour   = _bucket_start(ts, "hour")
    doc_id = f"{device_id}_{hour.strftime('%Y%m%d%H')}"

    nodes_inc = {}
    for node, s in (sensors or {}).items():
        node_inc = {}
        for short, long in _ROLLUP_SENSORS:
            val = s.get(long)
            if val is None:
                continue
            node_inc[f"{short}_sum"] = firestore.Increment(val)
            node_inc[f"{short}_n"]   = firestore.Increment(1)
        if node_inc:
            nodes_inc[node] = node_inc

    db.collection(HOURLY_COL).document(doc_id).set({
        "bucket_ts": hour,
        "device_id": device_id,
        "count":     firestore.Increment(1),
        "nodes":     nodes_inc,
    }, merge=True)


@app.get("/readings/history", summary="Histórico downsampled por hora/día")
def readings_history(
    from_: str = Query(None, alias="from", description="ISO-8601 UTC. Default: hace 7 días"),
    to:    str = Query(None, description="ISO-8601 UTC. Default: ahora"),
    bucket: str = Query("hour", pattern="^(hour|day)$"),
):
    """
    Lee de `readings_hourly` (pre-agregado por hora) y, si bucket='day',
    reagrupa a día. Quota-safe: 30 días ≈ 720 docs leídos en vez de ~57K crudos.

    Respuesta:
    ```json
    {
      "bucket": "hour", "from": "...", "to": "...",
      "total_docs": 1920, "hourly_docs_read": 168,
      "points": [
        { "ts": "2026-06-18T03:00:00+00:00", "count": 80,
          "nodes": { "interior": {"t":21.5,"h":65.2,...}, "exterior": {...} } }
      ]
    }
    ```
    """
    now     = datetime.now(timezone.utc)
    to_dt   = _parse_iso(to)    if to    else now
    from_dt = _parse_iso(from_) if from_ else to_dt - timedelta(days=7)

    if from_dt >= to_dt:
        raise HTTPException(status_code=400, detail="'from' debe ser anterior a 'to'")

    # Guarda de sanidad (con rollup horario el costo ya es bajo)
    span = to_dt - from_dt
    max_span = timedelta(days=31) if bucket == "hour" else timedelta(days=366)
    if span > max_span:
        raise HTTPException(
            status_code=400,
            detail=f"Rango demasiado grande para bucket='{bucket}' (máx {max_span.days} días)",
        )

    if not db:
        raise HTTPException(status_code=503, detail="Firestore no disponible")

    try:
        docs = (
            db.collection(HOURLY_COL)
            .where("bucket_ts", ">=", from_dt)
            .where("bucket_ts", "<=", to_dt)
            .order_by("bucket_ts")
            .stream()
        )

        # groups[bucket_iso] = { "count": n, "nodes": { node: { sensor: [sum, count] } } }
        groups: dict = {}
        hourly_docs_read = 0

        for doc in docs:
            d = doc.to_dict()
            bts = d.get("bucket_ts")
            if bts is None:
                continue
            hourly_docs_read += 1
            key = _bucket_start(bts, bucket).isoformat()
            g = groups.setdefault(key, {"count": 0, "nodes": {}})
            g["count"] += d.get("count", 0)

            for node, acc in (d.get("nodes") or {}).items():
                ga = g["nodes"].setdefault(node, {})
                for short, _long in _ROLLUP_SENSORS:
                    s = acc.get(f"{short}_sum")
                    n = acc.get(f"{short}_n")
                    if not n:
                        continue
                    pair = ga.setdefault(short, [0.0, 0])
                    pair[0] += s
                    pair[1] += n

        points = []
        total_readings = 0
        for key in sorted(groups):
            g = groups[key]
            total_readings += g["count"]
            node_avgs = {
                node: {short: round(s / n, 2) for short, (s, n) in acc.items() if n}
                for node, acc in g["nodes"].items()
            }
            points.append({"ts": key, "count": g["count"], "nodes": node_avgs})

        return {
            "bucket":           bucket,
            "from":             from_dt.isoformat(),
            "to":               to_dt.isoformat(),
            "total_docs":       total_readings,    # lecturas crudas representadas
            "hourly_docs_read": hourly_docs_read,  # costo real de lectura
            "points":           points,
            "source":           HOURLY_COL,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/admin/backfill-hourly", summary="Reconstruye readings_hourly desde datos crudos")
def backfill_hourly(
    from_: str = Query(None, alias="from", description="ISO-8601 UTC. Default: hace 30 días"),
    to:    str = Query(None),
    token: str = Query(None, description="Debe coincidir con env ADMIN_TOKEN si está seteado"),
):
    """
    Escanea `readings` en [from, to] y reconstruye los docs de `readings_hourly`
    (set/overwrite, idempotente). Correr una vez tras desplegar el rollup para
    poblar el histórico con los datos ya almacenados.
    """
    admin = os.getenv("ADMIN_TOKEN")
    if admin and token != admin:
        raise HTTPException(status_code=403, detail="token inválido")
    if not db:
        raise HTTPException(status_code=503, detail="Firestore no disponible")

    now     = datetime.now(timezone.utc)
    to_dt   = _parse_iso(to)    if to    else now
    from_dt = _parse_iso(from_) if from_ else to_dt - timedelta(days=30)

    try:
        docs = (
            db.collection("readings")
            .where("ts", ">=", from_dt)
            .where("ts", "<=", to_dt)
            .order_by("ts")
            .stream()
        )

        # buckets[(device, hour)] = { "count": n, "nodes": { node: { short: [sum, count] } } }
        buckets: dict = {}
        scanned = 0
        for doc in docs:
            d = doc.to_dict()
            ts = d.get("ts")
            if ts is None:
                continue
            scanned += 1
            hour = _bucket_start(ts, "hour")
            dev  = d.get("device_id", "unknown")
            b = buckets.setdefault((dev, hour), {"count": 0, "nodes": {}})
            b["count"] += 1
            for node, sensors in (d.get("sensors") or {}).items():
                acc = b["nodes"].setdefault(node, {})
                for short, long in _ROLLUP_SENSORS:
                    val = sensors.get(long)
                    if val is None:
                        continue
                    pair = acc.setdefault(short, [0.0, 0])
                    pair[0] += val
                    pair[1] += 1

        written = 0
        batch = db.batch()
        ops = 0
        for (dev, hour), b in buckets.items():
            nodes = {}
            for node, acc in b["nodes"].items():
                nd = {}
                for short, (s, n) in acc.items():
                    nd[f"{short}_sum"] = round(s, 4)
                    nd[f"{short}_n"]   = n
                nodes[node] = nd
            doc_id = f"{dev}_{hour.strftime('%Y%m%d%H')}"
            batch.set(db.collection(HOURLY_COL).document(doc_id), {
                "bucket_ts": hour,
                "device_id": dev,
                "count":     b["count"],
                "nodes":     nodes,
            })
            ops += 1
            written += 1
            if ops >= 400:
                batch.commit()
                batch = db.batch()
                ops = 0
        if ops:
            batch.commit()

        return {
            "scanned":             scanned,
            "hourly_docs_written": written,
            "from":                from_dt.isoformat(),
            "to":                  to_dt.isoformat(),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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
