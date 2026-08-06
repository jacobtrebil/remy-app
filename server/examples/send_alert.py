#!/usr/bin/env python3
"""
Drop-in client for remy-camera's backend.

    from send_alert import send_alert
    send_alert("critical", "Front door opened at 2:14 AM",
               "Entryway activity detected overnight.", source="Front Door")

Or from the shell, to smoke-test a running server:

    python3 server/examples/send_alert.py critical "Test" "Hello from the CLI"
"""

from __future__ import annotations

import os
import sys
from typing import Literal, Optional

import httpx

ALERTS_URL = os.getenv("REMY_ALERTS_URL", "http://localhost:8000")
INTERNAL_API_KEY = os.getenv("INTERNAL_API_KEY", "")

Severity = Literal["critical", "warning", "info"]


def send_alert(
    severity: Severity,
    title: str,
    body: str,
    *,
    source: Optional[str] = None,
    event_url: Optional[str] = None,
    device_ids: Optional[list[str]] = None,
    timeout: float = 10.0,
) -> dict:
    """
    Create an alert and push it to every registered device (or `device_ids`).

    Only severity="critical" bypasses silent mode and Do Not Disturb. Reserve it
    for events a caregiver would want to be woken up for.

    Returns the created alert plus a per-device delivery report; raises
    httpx.HTTPStatusError if the service rejects the request.
    """
    if not INTERNAL_API_KEY:
        raise RuntimeError("INTERNAL_API_KEY is not set")

    payload: dict[str, object] = {
        "severity": severity,
        "title": title,
        "body": body,
        "source": source,
        "event_url": event_url,
    }
    if device_ids is not None:
        payload["device_ids"] = device_ids

    res = httpx.post(
        f"{ALERTS_URL}/api/alerts",
        headers={"x-api-key": INTERNAL_API_KEY},
        json=payload,
        timeout=timeout,
    )
    res.raise_for_status()
    return res.json()


if __name__ == "__main__":
    if len(sys.argv) != 4:
        print(__doc__)
        sys.exit(1)

    severity, title, body = sys.argv[1], sys.argv[2], sys.argv[3]
    result = send_alert(severity, title, body, source="CLI")  # type: ignore[arg-type]

    for delivery in result["deliveries"]:
        mark = "ok" if delivery["ok"] else f"FAILED ({delivery.get('reason')})"
        print(f"  {delivery['device_id']}: {mark}")
    if not result["deliveries"]:
        print("  no devices registered")
