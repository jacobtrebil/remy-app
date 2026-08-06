# Remy Alerts

The iOS companion app for [remycamera.com](https://remycamera.com). Its one job is to
get a caregiver's attention when something actually matters — using **Apple Critical
Alerts**, which play at full volume and bypass silent mode, Do Not Disturb and Focus.

Two pieces:

| Path      | What it is                                                             |
| --------- | ---------------------------------------------------------------------- |
| `src/`    | Expo / React Native app — alert feed, permissions, acknowledge, self-test |
| `server/` | FastAPI push service — device registry + direct APNs HTTP/2 sender      |

```
remy-camera backend ──POST /api/alerts──▶ server/ ──APNs HTTP/2──▶ 📱 Remy Alerts
```

---

## ⚠️ Read this first: the entitlement

Critical alerts do **not** work without a special entitlement that Apple grants
case-by-case. Everything else in this repo is wired up and ready; this is the one
step you cannot do yourself.

1. Apply at <https://developer.apple.com/contact/request/notifications-critical-alerts>.
   Apple expects a genuine health/safety/public-safety justification — Remy's
   wandering and stove-safety events qualify, generic engagement pushes do not.
   Turnaround is typically days to weeks.
2. Once approved, the entitlement is attached to your App ID. Regenerate your
   provisioning profiles (`eas build` does this automatically).
3. `app.json` already declares it:

   ```json
   "entitlements": { "com.apple.developer.usernotifications.critical-alerts": true }
   ```

**Before approval:** the app builds and runs, but iOS silently ignores
`allowCriticalAlerts`. `sound: {critical: 1}` payloads are delivered as ordinary
notifications, so Focus and the ringer switch will silence them. The Settings
screen reports this honestly — "Critical alerts: Not allowed" — so you can tell
the two failure modes apart.

Also note: users get a **second, separate permission prompt** for critical alerts,
and they can revoke it independently in iOS Settings. `criticalGranted` in the
app tracks that, and it is sent to the server on every registration.

---

## Setup

### 1. The app

```bash
npm install
cp env.example .env        # optional in dev; see src/lib/config.ts for the fallback
```

Critical alerts need a **physical device** and a **development build** — Expo Go
cannot carry custom entitlements, and simulators never receive APNs pushes.

```bash
npx expo prebuild --clean   # generates ios/ with the entitlement wired in
npx expo run:ios --device   # build and install on a connected iPhone
```

Or via EAS, which handles the signing:

```bash
eas build --profile development --platform ios
```

Set `extra.eas.projectId` in `app.json` first (`eas init` fills it in).

### 2. The push service

```bash
cd server
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp env.example .env         # then fill in APNs credentials
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

`--host 0.0.0.0` matters: the phone reaches the server over the LAN, not localhost.

Get the APNs key from **Apple Developer → Certificates, Identifiers & Profiles →
Keys** — create one with "Apple Push Notifications service (APNs)" enabled. The
`.p8` file downloads exactly once; `.gitignore` covers `*.p8`.

Check the wiring:

```bash
curl localhost:8000/health
# {"ok":true,"apns_configured":true,"apns_environment":"sandbox",...}
```

### 3. Verify it actually works

The only test that counts:

1. Open the app, tap **Settings & test alert**, grant both prompts.
2. Confirm **Critical alerts: Allowed**.
3. Lock the phone, flip the mute switch, turn on Do Not Disturb.
4. Tap **Send test critical alert**.

If it rings at full volume through all of that, you're done. If it arrives
silently, the entitlement isn't active on that build.

---

## Sending an alert from remy-camera

```python
import httpx

httpx.post(
    "http://localhost:8000/api/alerts",
    headers={"x-api-key": INTERNAL_API_KEY},
    json={
        "severity": "critical",           # critical | warning | info
        "title": "Front door opened at 2:14 AM",
        "body": "Entryway activity detected overnight. Tap to review.",
        "source": "Front Door",
        "event_url": "https://app.remycamera.com/events/abc123",
    },
    timeout=10,
)
```

Omit `device_ids` to fan out to every registered device. See
`server/examples/send_alert.py` for a copy-pasteable client.

**Only `severity: "critical"` produces a critical alert.** `warning` maps to
iOS's time-sensitive interruption level and `info` to a normal notification.
Use `critical` sparingly — it is the one channel that can wake someone at 3 AM,
and it stops working the moment people start ignoring it.

### API

| Method   | Path                    | Auth            | Purpose                          |
| -------- | ----------------------- | --------------- | -------------------------------- |
| `GET`    | `/health`               | none            | Config and connectivity check    |
| `POST`   | `/api/devices`          | `API_KEY`       | Register / refresh a push token  |
| `DELETE` | `/api/devices/{id}`     | `API_KEY`       | Unregister                       |
| `GET`    | `/api/alerts`           | `API_KEY`       | Recent alerts (app feed)         |
| `GET`    | `/api/alerts/{id}`      | `API_KEY`       | One alert                        |
| `POST`   | `/api/alerts/{id}/ack`  | `API_KEY`       | Acknowledge                      |
| `POST`   | `/api/alerts/test`      | `API_KEY`       | Self-test to one device          |
| `POST`   | `/api/alerts`           | `INTERNAL_API_KEY` | **Create + send** (remy-camera) |

Two keys on purpose: `API_KEY` ships inside the app bundle and is therefore
public, so it only gates registration and reads. `INTERNAL_API_KEY` is the one
that can actually send pushes and lives only on remy-camera's backend.

---

## The alert sound

`assets/sounds/remy-critical.wav` is generated by `scripts/make-alert-sound.py`
(`npm run sound`) — a two-tone alarm chosen to be unmistakably not a text
message. Swap in your own if you like; the constraints are:

- ≤ 30 seconds, `.wav` / `.aiff` / `.caf`
- listed in the `expo-notifications` plugin's `sounds` array in `app.json`
- `CRITICAL_SOUND` in `server/.env` must match the filename exactly

Then re-run `npx expo prebuild --clean` so it lands in the bundle.

## Gotchas

- **Sandbox vs production tokens are not interchangeable.** A dev-build token
  sent to `api.push.apple.com` returns `BadDeviceToken`. Flip `APNS_USE_SANDBOX`
  to match the build; `/health` reports which one is live.
- **TestFlight uses production APNs**, even though it feels like a dev build.
- **Device tokens rotate.** The app re-registers on every launch, and the server
  drops tokens APNs reports as `Unregistered` or `BadDeviceToken`.
- **`interruption-level: critical` also needs the entitlement** — it is set
  alongside the critical sound in `server/app/apns.py`.
- **Android** is scaffolded (notification channel with `bypassDnd`) but there is
  no FCM sender yet; `_fan_out` returns `UnsupportedPlatform` for those devices.

## Storage

SQLite at `server/data/remy.db`, two tables, no ORM. Fine for a single household
and a handful of devices. If this grows to real multi-tenant use, that's the
piece to replace — the rest of the service doesn't care.
