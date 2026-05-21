from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional


class SensorReadings(BaseModel):
    temperature: float = Field(..., ge=-40, le=85,  description="Temperatura en °C")
    humidity:    float = Field(..., ge=0,   le=100,  description="Humedad relativa en %")
    light:       float = Field(..., ge=0,            description="Luminosidad en lux")


class ReadingPayload(BaseModel):
    device_id:        str            = Field(..., description="ID único del dispositivo ESP32")
    timestamp:        Optional[datetime] = Field(None, description="ISO 8601, si el ESP tiene RTC. Null = server time.")
    readings:         SensorReadings
    firmware_version: Optional[str] = Field(None, description="Versión de firmware del ESP32")


class ReadingResponse(BaseModel):
    status:      str
    received_at: datetime
    device_id:   str
    message:     Optional[str] = None
