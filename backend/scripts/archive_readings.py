"""
Archivo del crudo de Firestore → Cloud Storage (NDJSON gzippeado, un archivo por día).

Preserva las lecturas crudas de `readings` ANTES de que el TTL (retención 21 días)
las borre. Pensado para correr a diario desde GitHub Actions.

- Exporta días por received_at a `gs://{BUCKET}/{PREFIX}/YYYY-MM-DD.ndjson.gz`.
- Por default exporta la ventana "por vencer" (días con edad 18..20) -buffer antes
  de que el TTL borre (~edad 22-24). Tolera runs perdidos.
- Skip-if-exists: si el archivo del día ya está en GCS, NO re-lee Firestore (ahorra quota).
  Override con ARCHIVE_FORCE=1.
- Rango manual: ARCHIVE_FROM / ARCHIVE_TO (YYYY-MM-DD) para backfill puntual.

Credenciales:
- FIREBASE_KEY_B64 (env, base64 del service account JSON) -usado en CI.
- o FIREBASE_KEY (path, default firebase-key.json local).

Env vars:
- ARCHIVE_BUCKET   (default xlimax-c8bb4.firebasestorage.app)
- ARCHIVE_PREFIX   (default archivo/raw)
- ARCHIVE_FROM, ARCHIVE_TO (YYYY-MM-DD)  -si se setean, exporta ese rango inclusive
- ARCHIVE_AGE_MIN, ARCHIVE_AGE_MAX (int, default 18 y 20) -ventana por edad si no hay FROM/TO
- ARCHIVE_FORCE=1   -re-exporta aunque el archivo ya exista
"""
import os
import io
import json
import gzip
import base64
from datetime import datetime, timezone, timedelta

import firebase_admin
from firebase_admin import credentials, firestore, storage

BUCKET  = os.getenv("ARCHIVE_BUCKET", "xlimax-c8bb4.firebasestorage.app")
PREFIX  = os.getenv("ARCHIVE_PREFIX", "archivo/raw").strip("/")
PAGE    = 2000
FORCE   = os.getenv("ARCHIVE_FORCE", "") not in ("", "0", "false", "False")


def _init():
    b64 = os.environ.get("FIREBASE_KEY_B64")
    if b64:
        cred = credentials.Certificate(json.loads(base64.b64decode(b64).decode("utf-8")))
    else:
        path = os.getenv("FIREBASE_KEY", r"C:\xlimax\firebase-key.json")
        cred = credentials.Certificate(path)
    firebase_admin.initialize_app(cred, {"storageBucket": BUCKET})


def _json_default(o):
    if hasattr(o, "isoformat"):
        return o.isoformat()
    return str(o)


def _days_to_export():
    """Lista de date (UTC) a exportar, según ARCHIVE_FROM/TO o ventana por edad."""
    today = datetime.now(timezone.utc).date()
    f, t = os.getenv("ARCHIVE_FROM"), os.getenv("ARCHIVE_TO")
    if f or t:
        start = datetime.fromisoformat(f).date() if f else (today - timedelta(days=30))
        end   = datetime.fromisoformat(t).date() if t else today
    else:
        amin = int(os.getenv("ARCHIVE_AGE_MIN", "18"))
        amax = int(os.getenv("ARCHIVE_AGE_MAX", "20"))
        start = today - timedelta(days=amax)
        end   = today - timedelta(days=amin)
    out, d = [], start
    while d <= end:
        out.append(d)
        d += timedelta(days=1)
    return out


def export_day(db, bucket, day):
    """Exporta los docs de `readings` con received_at en [day, day+1) a un .ndjson.gz en GCS."""
    blob_path = f"{PREFIX}/{day.isoformat()}.ndjson.gz"
    blob = bucket.blob(blob_path)

    if not FORCE and blob.exists():
        print(f"[skip] {day} - ya existe gs://{BUCKET}/{blob_path}")
        return 0

    start = datetime(day.year, day.month, day.day, tzinfo=timezone.utc)
    end   = start + timedelta(days=1)
    base_q = (db.collection("readings")
              .where("received_at", ">=", start)
              .where("received_at", "<", end)
              .order_by("received_at"))

    buf, last, n = io.StringIO(), None, 0
    while True:
        q = base_q.limit(PAGE)
        if last is not None:
            q = q.start_after(last)
        page = list(q.stream())
        if not page:
            break
        for doc in page:
            d = doc.to_dict()
            d["_id"] = doc.id
            buf.write(json.dumps(d, default=_json_default, ensure_ascii=False) + "\n")
            n += 1
        last = page[-1]
        if len(page) < PAGE:
            break

    if n == 0:
        print(f"[empty] {day} - sin docs")
        return 0

    gz = gzip.compress(buf.getvalue().encode("utf-8"))
    blob.upload_from_string(gz, content_type="application/gzip")
    print(f"[ok]   {day} - {n} docs -> gs://{BUCKET}/{blob_path} ({len(gz)/1024:.0f} KB)")
    return n


def main():
    _init()
    db = firestore.client()
    bucket = storage.bucket()  # usa storageBucket de initialize_app

    days = _days_to_export()
    print(f"Archivo crudo -> gs://{BUCKET}/{PREFIX}  | dias: {days[0]}..{days[-1]} ({len(days)}) | force={FORCE}")
    total = 0
    for day in days:
        total += export_day(db, bucket, day)
    print(f"DONE: {total} docs exportados en esta corrida.")


if __name__ == "__main__":
    main()
