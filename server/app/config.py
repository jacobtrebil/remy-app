"""Configuration, loaded from the environment. See server/.env.example."""

from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv

SERVER_DIR = Path(__file__).resolve().parent.parent

# Real environment variables win, so a deployed service ignores any stray .env.
load_dotenv(SERVER_DIR / ".env", override=False)


def _bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    return default if raw is None else raw.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
    # --- APNs credentials (Apple Developer -> Keys -> Apple Push Notifications service) ---
    apns_key_id: str
    apns_team_id: str
    apns_key_path: Path
    apns_topic: str
    """The app's bundle identifier. Must match ios.bundleIdentifier in app.json."""

    apns_use_sandbox: bool
    """
    True for development/TestFlight-from-Xcode builds, False for App Store and
    TestFlight builds. Tokens are not interchangeable between the two — sending a
    sandbox token to production returns BadDeviceToken.
    """

    # --- Service ---
    api_key: str
    """Shared secret for device endpoints; sent as x-api-key."""

    internal_api_key: str
    """Separate secret for POST /api/alerts, which is what actually sends pushes."""

    database_path: Path
    critical_sound: str
    """Filename of the bundled sound, or "default". Must exist in the app bundle."""

    @property
    def apns_host(self) -> str:
        return (
            "api.sandbox.push.apple.com"
            if self.apns_use_sandbox
            else "api.push.apple.com"
        )

    @property
    def configured(self) -> bool:
        """False when APNs creds are missing — the API still runs, sends fail loudly."""
        return bool(
            self.apns_key_id
            and self.apns_team_id
            and self.apns_topic
            and self.apns_key_path.is_file()
        )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings(
        apns_key_id=os.getenv("APNS_KEY_ID", ""),
        apns_team_id=os.getenv("APNS_TEAM_ID", ""),
        apns_key_path=Path(os.getenv("APNS_KEY_PATH", str(SERVER_DIR / "AuthKey.p8"))),
        apns_topic=os.getenv("APNS_TOPIC", "com.remycamera.alerts"),
        apns_use_sandbox=_bool("APNS_USE_SANDBOX", True),
        api_key=os.getenv("API_KEY", ""),
        internal_api_key=os.getenv("INTERNAL_API_KEY", ""),
        database_path=Path(os.getenv("DATABASE_PATH", str(SERVER_DIR / "data" / "remy.db"))),
        critical_sound=os.getenv("CRITICAL_SOUND", "remy_critical.wav"),
    )
