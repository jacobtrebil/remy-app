"""
Direct APNs HTTP/2 client with token-based (.p8) authentication.

We talk to Apple ourselves rather than going through the Expo push service,
because Expo's API does not forward the `sound.critical` flag — and that flag is
the entire reason this app exists.
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from typing import Any, Optional

import httpx
import jwt

from .config import Settings, get_settings
from .schemas import Severity

log = logging.getLogger(__name__)

# Apple rejects provider tokens older than 1 hour and throttles refreshes more
# frequent than every 20 minutes. 50 minutes sits safely between the two.
_TOKEN_TTL_SECONDS = 50 * 60

# Alerts are worthless if they show up an hour late; let APNs drop them instead.
_EXPIRATION_SECONDS = 60 * 60

_INTERRUPTION_LEVEL: dict[Severity, str] = {
    "critical": "critical",
    "warning": "time-sensitive",
    "info": "active",
}


class ApnsNotConfigured(RuntimeError):
    pass


@dataclass
class ApnsResponse:
    ok: bool
    status: int
    reason: Optional[str]
    apns_id: Optional[str] = None

    @property
    def token_is_dead(self) -> bool:
        """True when the device should be dropped from the registry."""
        return self.reason in {"BadDeviceToken", "Unregistered", "DeviceTokenNotForTopic"}


class ApnsClient:
    """Long-lived; reuses one HTTP/2 connection and caches the provider JWT."""

    def __init__(self, settings: Optional[Settings] = None) -> None:
        self._settings = settings or get_settings()
        self._client: Optional[httpx.AsyncClient] = None
        self._token: Optional[str] = None
        self._token_issued_at: float = 0.0

    async def aclose(self) -> None:
        if self._client is not None:
            await self._client.aclose()
            self._client = None

    def _http(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(
                http2=True,
                base_url=f"https://{self._settings.apns_host}",
                timeout=httpx.Timeout(10.0),
            )
        return self._client

    def _provider_token(self) -> str:
        now = time.time()
        if self._token and now - self._token_issued_at < _TOKEN_TTL_SECONDS:
            return self._token

        s = self._settings
        if not s.configured:
            raise ApnsNotConfigured(
                "APNs is not configured — set APNS_KEY_ID, APNS_TEAM_ID, APNS_TOPIC "
                f"and place the .p8 key at {s.apns_key_path}"
            )

        self._token = jwt.encode(
            {"iss": s.apns_team_id, "iat": int(now)},
            s.apns_key_path.read_text(),
            algorithm="ES256",
            headers={"kid": s.apns_key_id},
        )
        self._token_issued_at = now
        return self._token

    def build_payload(
        self,
        *,
        severity: Severity,
        title: str,
        body: str,
        alert_id: str,
        badge: int,
    ) -> dict[str, Any]:
        aps: dict[str, Any] = {
            "alert": {"title": title, "body": body},
            "badge": badge,
            "interruption-level": _INTERRUPTION_LEVEL[severity],
        }

        if severity == "critical":
            # The critical sound dictionary is what bypasses the ringer switch,
            # Do Not Disturb and Focus. It only works if the app was built with
            # the com.apple.developer.usernotifications.critical-alerts
            # entitlement AND the user accepted the critical-alert prompt.
            aps["sound"] = {
                "critical": 1,
                "name": self._settings.critical_sound,
                "volume": 1.0,
            }
        else:
            aps["sound"] = self._settings.critical_sound

        return {"aps": aps, "alert_id": alert_id, "severity": severity}

    async def send(
        self,
        *,
        device_token: str,
        payload: dict[str, Any],
        collapse_id: Optional[str] = None,
    ) -> ApnsResponse:
        headers = {
            "authorization": f"bearer {self._provider_token()}",
            "apns-topic": self._settings.apns_topic,
            "apns-push-type": "alert",
            # 10 = deliver immediately. Critical alerts must never be throttled
            # into a delivery window.
            "apns-priority": "10",
            "apns-expiration": str(int(time.time()) + _EXPIRATION_SECONDS),
        }
        if collapse_id:
            headers["apns-collapse-id"] = collapse_id[:64]

        try:
            res = await self._http().post(
                f"/3/device/{device_token}", json=payload, headers=headers
            )
        except httpx.HTTPError as exc:
            log.warning("APNs request failed: %s", exc)
            return ApnsResponse(ok=False, status=0, reason=str(exc))

        if res.status_code == 200:
            return ApnsResponse(ok=True, status=200, reason=None, apns_id=res.headers.get("apns-id"))

        reason = None
        try:
            reason = res.json().get("reason")
        except ValueError:
            reason = res.text or None

        log.warning("APNs rejected push: %s %s", res.status_code, reason)
        return ApnsResponse(
            ok=False,
            status=res.status_code,
            reason=reason,
            apns_id=res.headers.get("apns-id"),
        )
