from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class Readings(BaseModel):
    temperature:  float
    humidity:     float
    light:        float
    pressure_hpa: Optional[float] = None
    altitude_m:   Optional[float] = None


class ReadingPayload(BaseModel):
    device_id:        str
    timestamp:        Optional[datetime] = None
    readings:         Readings
    firmware_version: str


class ReadingResponse(BaseModel):
    status:      str
    received_at: datetime
    device_id:   str
