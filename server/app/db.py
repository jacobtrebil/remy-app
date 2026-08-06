"""SQLite storage. Two tables is the whole data model, so no ORM."""

from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Iterator, Optional

from .config import get_settings

SCHEMA = """
CREATE TABLE IF NOT EXISTS devices (
    device_id               TEXT PRIMARY KEY,
    push_token              TEXT NOT NULL,
    platform                TEXT NOT NULL,
    critical_alerts_granted INTEGER NOT NULL DEFAULT 0,
    app_version             TEXT NOT NULL DEFAULT '0.0.0',
    updated_at              TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS alerts (
    id              TEXT PRIMARY KEY,
    severity        TEXT NOT NULL,
    title           TEXT NOT NULL,
    body            TEXT NOT NULL,
    source          TEXT,
    event_url       TEXT,
    created_at      TEXT NOT NULL,
    acknowledged_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts (created_at DESC);
"""


def utcnow() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


@contextmanager
def connect() -> Iterator[sqlite3.Connection]:
    settings = get_settings()
    settings.database_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(settings.database_path)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db() -> None:
    with connect() as conn:
        conn.executescript(SCHEMA)


# --- devices ---------------------------------------------------------------


def upsert_device(
    device_id: str,
    push_token: str,
    platform: str,
    critical_alerts_granted: bool,
    app_version: str,
) -> sqlite3.Row:
    with connect() as conn:
        # A token can migrate between installs (restore from backup); keep the
        # newest device_id for it so we never push the same alert twice.
        conn.execute(
            "DELETE FROM devices WHERE push_token = ? AND device_id != ?",
            (push_token, device_id),
        )
        conn.execute(
            """
            INSERT INTO devices (device_id, push_token, platform,
                                 critical_alerts_granted, app_version, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(device_id) DO UPDATE SET
                push_token = excluded.push_token,
                platform = excluded.platform,
                critical_alerts_granted = excluded.critical_alerts_granted,
                app_version = excluded.app_version,
                updated_at = excluded.updated_at
            """,
            (device_id, push_token, platform, int(critical_alerts_granted), app_version, utcnow()),
        )
        return conn.execute(
            "SELECT * FROM devices WHERE device_id = ?", (device_id,)
        ).fetchone()


def get_device(device_id: str) -> Optional[sqlite3.Row]:
    with connect() as conn:
        return conn.execute(
            "SELECT * FROM devices WHERE device_id = ?", (device_id,)
        ).fetchone()


def list_devices(device_ids: Optional[list[str]] = None) -> list[sqlite3.Row]:
    with connect() as conn:
        if device_ids is None:
            return conn.execute("SELECT * FROM devices").fetchall()
        if not device_ids:
            return []
        placeholders = ",".join("?" * len(device_ids))
        return conn.execute(
            f"SELECT * FROM devices WHERE device_id IN ({placeholders})", device_ids
        ).fetchall()


def delete_device(device_id: str) -> None:
    with connect() as conn:
        conn.execute("DELETE FROM devices WHERE device_id = ?", (device_id,))


# --- alerts ----------------------------------------------------------------


def insert_alert(
    alert_id: str,
    severity: str,
    title: str,
    body: str,
    source: Optional[str],
    event_url: Optional[str],
) -> sqlite3.Row:
    with connect() as conn:
        conn.execute(
            """
            INSERT INTO alerts (id, severity, title, body, source, event_url, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (alert_id, severity, title, body, source, event_url, utcnow()),
        )
        return conn.execute("SELECT * FROM alerts WHERE id = ?", (alert_id,)).fetchone()


def get_alert(alert_id: str) -> Optional[sqlite3.Row]:
    with connect() as conn:
        return conn.execute("SELECT * FROM alerts WHERE id = ?", (alert_id,)).fetchone()


def list_alerts(limit: int = 50) -> list[sqlite3.Row]:
    with connect() as conn:
        return conn.execute(
            "SELECT * FROM alerts ORDER BY created_at DESC LIMIT ?", (limit,)
        ).fetchall()


def acknowledge_alert(alert_id: str) -> Optional[sqlite3.Row]:
    with connect() as conn:
        # First ack wins, so the timestamp reflects when someone actually saw it.
        conn.execute(
            "UPDATE alerts SET acknowledged_at = ? WHERE id = ? AND acknowledged_at IS NULL",
            (utcnow(), alert_id),
        )
        return conn.execute("SELECT * FROM alerts WHERE id = ?", (alert_id,)).fetchone()


def unacknowledged_count() -> int:
    with connect() as conn:
        row = conn.execute(
            "SELECT COUNT(*) AS n FROM alerts WHERE acknowledged_at IS NULL"
        ).fetchone()
        return int(row["n"])
