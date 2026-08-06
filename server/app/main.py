"""
Remy critical-alert push service.

Two audiences, two keys:
  * the mobile app  -> x-api-key: API_KEY          (register, read, ack, self-test)
  * remy-camera     -> x-api-key: INTERNAL_API_KEY (POST /api/alerts, which sends pushes)
"""

from __future__ import annotations

import asyncio
import logging
import sqlite3
import uuid
from contextlib import asynccontextmanager
from typing import Annotated, Optional

from fastapi import Depends, FastAPI, Header, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware

from . import db
from .apns import ApnsClient, ApnsNotConfigured
from .config import get_settings
from .schemas import (
    AlertCreated,
    AlertIn,
    AlertOut,
    DeliveryResult,
    DeviceIn,
    DeviceOut,
    TestIn,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
log = logging.getLogger("remy.alerts")

apns = ApnsClient()


@asynccontextmanager
async def lifespan(app: FastAPI):
    db.init_db()
    settings = get_settings()
    if not settings.configured:
        log.warning(
            "APNs is not configured — the API will serve reads but every push will fail. "
            "See server/.env.example."
        )
    else:
        log.info(
            "APNs ready: topic=%s host=%s", settings.apns_topic, settings.apns_host
        )
    yield
    await apns.aclose()


app = FastAPI(title="Remy Alerts", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- auth ------------------------------------------------------------------


def require_app_key(x_api_key: Annotated[Optional[str], Header()] = None) -> None:
    expected = get_settings().api_key
    # An empty API_KEY leaves the device endpoints open, which is convenient for
    # local development and must not be how this runs in production.
    if expected and x_api_key != expected:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid API key")


def require_internal_key(x_api_key: Annotated[Optional[str], Header()] = None) -> None:
    expected = get_settings().internal_api_key
    if not expected:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "INTERNAL_API_KEY is not set; refusing to accept alert submissions",
        )
    if x_api_key != expected:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid API key")


AppAuth = Depends(require_app_key)
InternalAuth = Depends(require_internal_key)


# --- serialization ---------------------------------------------------------


def to_alert(row: sqlite3.Row) -> AlertOut:
    return AlertOut(
        id=row["id"],
        severity=row["severity"],
        title=row["title"],
        body=row["body"],
        source=row["source"],
        created_at=row["created_at"],
        acknowledged_at=row["acknowledged_at"],
        event_url=row["event_url"],
    )


def to_device(row: sqlite3.Row) -> DeviceOut:
    return DeviceOut(
        device_id=row["device_id"],
        push_token=row["push_token"],
        platform=row["platform"],
        critical_alerts_granted=bool(row["critical_alerts_granted"]),
        app_version=row["app_version"],
    )


# --- health ----------------------------------------------------------------


@app.get("/health")
async def health() -> dict[str, object]:
    settings = get_settings()
    return {
        "ok": True,
        "apns_configured": settings.configured,
        "apns_environment": "sandbox" if settings.apns_use_sandbox else "production",
        "topic": settings.apns_topic,
        "devices": len(db.list_devices()),
    }


# --- devices ---------------------------------------------------------------


@app.post("/api/devices", response_model=DeviceOut, dependencies=[AppAuth])
async def register_device(payload: DeviceIn) -> DeviceOut:
    row = db.upsert_device(
        device_id=payload.device_id,
        push_token=payload.push_token,
        platform=payload.platform,
        critical_alerts_granted=payload.critical_alerts_granted,
        app_version=payload.app_version,
    )
    log.info(
        "registered device %s (critical_alerts=%s)",
        payload.device_id,
        payload.critical_alerts_granted,
    )
    return to_device(row)


@app.delete("/api/devices/{device_id}", status_code=204, dependencies=[AppAuth])
async def unregister_device(device_id: str) -> None:
    db.delete_device(device_id)


# --- alerts ----------------------------------------------------------------


@app.get("/api/alerts", response_model=list[AlertOut], dependencies=[AppAuth])
async def list_alerts(limit: int = Query(default=50, ge=1, le=200)) -> list[AlertOut]:
    return [to_alert(row) for row in db.list_alerts(limit)]


@app.get("/api/alerts/{alert_id}", response_model=AlertOut, dependencies=[AppAuth])
async def read_alert(alert_id: str) -> AlertOut:
    row = db.get_alert(alert_id)
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No such alert")
    return to_alert(row)


@app.post("/api/alerts/{alert_id}/ack", response_model=AlertOut, dependencies=[AppAuth])
async def ack_alert(alert_id: str) -> AlertOut:
    row = db.acknowledge_alert(alert_id)
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No such alert")
    return to_alert(row)


@app.post(
    "/api/alerts",
    response_model=AlertCreated,
    status_code=201,
    dependencies=[InternalAuth],
)
async def create_alert(payload: AlertIn) -> AlertCreated:
    """Called by remy-camera when an event warrants notifying the caregiver."""
    alert_id = str(uuid.uuid4())
    row = db.insert_alert(
        alert_id=alert_id,
        severity=payload.severity,
        title=payload.title,
        body=payload.body,
        source=payload.source,
        event_url=payload.event_url,
    )

    deliveries = await _fan_out(
        alert_id=alert_id,
        severity=payload.severity,
        title=payload.title,
        body=payload.body,
        device_ids=payload.device_ids,
    )
    return AlertCreated(alert=to_alert(row), deliveries=deliveries)


@app.post("/api/alerts/test", response_model=AlertCreated, dependencies=[AppAuth])
async def send_test_alert(payload: TestIn) -> AlertCreated:
    """Self-test from the Settings screen — sends a real critical alert to one device."""
    if db.get_device(payload.device_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Device is not registered")

    alert_id = str(uuid.uuid4())
    title = "Test critical alert"
    body = "If you heard this with your phone silenced, critical alerts are working."
    row = db.insert_alert(alert_id, "critical", title, body, "Test", None)

    deliveries = await _fan_out(
        alert_id=alert_id,
        severity="critical",
        title=title,
        body=body,
        device_ids=[payload.device_id],
    )
    return AlertCreated(alert=to_alert(row), deliveries=deliveries)


async def _fan_out(
    *,
    alert_id: str,
    severity: str,
    title: str,
    body: str,
    device_ids: Optional[list[str]],
) -> list[DeliveryResult]:
    devices = db.list_devices(device_ids)
    if not devices:
        log.warning("alert %s has no target devices", alert_id)
        return []

    badge = db.unacknowledged_count()

    try:
        payload = apns.build_payload(
            severity=severity, title=title, body=body, alert_id=alert_id, badge=badge
        )
    except ApnsNotConfigured as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(exc)) from exc

    async def deliver(device: sqlite3.Row) -> DeliveryResult:
        if device["platform"] != "ios":
            # Android would need an FCM path; not wired up yet.
            return DeliveryResult(
                device_id=device["device_id"], ok=False, reason="UnsupportedPlatform"
            )
        try:
            res = await apns.send(
                device_token=device["push_token"],
                payload=payload,
                collapse_id=alert_id,
            )
        except ApnsNotConfigured as exc:
            return DeliveryResult(device_id=device["device_id"], ok=False, reason=str(exc))

        if res.token_is_dead:
            # The app was deleted or the token was reissued; stop pushing to it.
            log.info("dropping dead device %s (%s)", device["device_id"], res.reason)
            db.delete_device(device["device_id"])

        return DeliveryResult(
            device_id=device["device_id"], ok=res.ok, status=res.status, reason=res.reason
        )

    results = await asyncio.gather(*(deliver(d) for d in devices))
    delivered = sum(1 for r in results if r.ok)
    log.info("alert %s (%s): delivered to %d/%d", alert_id, severity, delivered, len(results))
    return list(results)
