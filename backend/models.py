from pydantic import BaseModel
from datetime import datetime
from typing import Optional, Dict


class SensorReadings(BaseModel):
    temperature:  float
    humidity:     float
    light:        float = 0.0
    pressure_hpa: Optional[float] = None
    altitude_m:   Optional[float] = None


class ReadingPayload(BaseModel):
    device_id:        str
    firmware_version: str
    timestamp:        Optional[datetime] = None
    sensors:          Dict[str, SensorReadings]   # ej: {"interior": ..., "exterior": ...}


class ReadingResponse(BaseModel):
    status:      str
    received_at: datetime
    device_id:   str
    sensors_ok:  int   # cuántos sensores se guardaron
