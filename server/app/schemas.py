"""Request/response models. Keep in sync with src/lib/types.ts."""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field

Severity = Literal["critical", "warning", "info"]
Platform = Literal["ios", "android"]


class DeviceIn(BaseModel):
    device_id: str = Field(min_length=8, max_length=64)
    push_token: str = Field(min_length=32, max_length=200)
    platform: Platform
    critical_alerts_granted: bool = False
    app_version: str = "0.0.0"


class DeviceOut(BaseModel):
    device_id: str
    push_token: str
    platform: Platform
    critical_alerts_granted: bool
    app_version: str


class AlertIn(BaseModel):
    """What remy-camera POSTs when an event warrants notifying the caregiver."""

    severity: Severity = "info"
    title: str = Field(min_length=1, max_length=120)
    body: str = Field(min_length=1, max_length=500)
    source: Optional[str] = Field(default=None, max_length=80)
    event_url: Optional[str] = Field(default=None, max_length=500)
    device_ids: Optional[list[str]] = None
    """Restrict delivery to these devices. Omit to fan out to every device."""


class AlertOut(BaseModel):
    id: str
    severity: Severity
    title: str
    body: str
    source: Optional[str]
    created_at: str
    acknowledged_at: Optional[str]
    event_url: Optional[str]


class DeliveryResult(BaseModel):
    device_id: str
    ok: bool
    status: Optional[int] = None
    reason: Optional[str] = None


class AlertCreated(BaseModel):
    alert: AlertOut
    deliveries: list[DeliveryResult]


class TestIn(BaseModel):
    device_id: str
