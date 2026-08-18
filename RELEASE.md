# Shipping Remy Alerts to the App Store

This app is **already a native iOS app**. `npx expo prebuild` generates a real
Xcode project in `ios/` that compiles to a normal `.ipa` — there is no web view
and nothing to wrap. Adding Capacitor would mean rewriting the UI as a web page
inside a `WKWebView` and rebuilding the notification layer as a custom plugin,
which would cost the critical-alert integration for nothing in return.

So: no packaging step to invent. What follows is build + submit.

---

## Blockers to clear first

These are ordered by how likely they are to get the submission rejected.

### 1. The push service is not deployed yet

`eas.json` points production builds at `https://app.remycamera.com`. That host is
live on Railway, but it serves the **Vite web app** ("Remy — Care Companion"),
not this repo's `server/`. Being a single-page app, it answers *every* path with
`200 text/html`:

```
$ curl -s -o /dev/null -w '%{http_code} %{content_type}\n' https://app.remycamera.com/api/alerts
200 text/html; charset=utf-8
```

So the alert endpoints resolve to the web app's `index.html`. `src/lib/api.ts`
detects the non-JSON response and reports it plainly rather than dying on a JSON
parse error, but the app has no data until `server/` is actually deployed there.

Two ways to fix it, both fine:

- **Separate Railway service** on its own subdomain, then point
  `EXPO_PUBLIC_API_URL` at that. Simplest, and keeps the push service
  independently deployable.
- **Same domain, path-prefixed** — route `app.remycamera.com/api/alerts/*` to
  this service ahead of the SPA catch-all.

App Review runs the app on a device in California. A reviewer who opens it and
sees an error instead of alerts is a **Guideline 2.1 — App Completeness**
rejection, and it is the most likely way this submission fails. Confirm
`/health` answers from outside your network before submitting.

### 2. Every device currently sees every alert

`GET /api/alerts` returns the full alert table to anyone holding `API_KEY` — and
`API_KEY` ships inside the app bundle, so it is public by construction. That is
fine for one household running its own server. It is **not** shippable to the
App Store, where household B would read household A's alerts, including camera
event descriptions and timestamps.

Before public distribution, alerts need to be scoped to an account or household,
and the app needs a sign-in to establish which one. This is a real feature, not
a config change — worth deciding on before you spend time on store metadata.

If you only want this on your own family's phones, **TestFlight internal testing
sidesteps all of this** and needs no review. That may be the right destination
for a while.

### 3. Critical alerts entitlement

Do not submit a build requesting the entitlement before Apple grants it — the
upload fails signing validation. `app.config.ts` keeps it out by default:

```bash
eas build --profile production            # no entitlement (use until approved)
eas build --profile production-critical   # entitlement on (use after approval)
```

Once approved, `production-critical` is the profile you ship.

### 4. Privacy policy URL

The app registers a device identifier and push token, so App Store Connect
requires a privacy policy URL. `app.config.ts` declares the matching privacy
manifest (device ID, app functionality, not linked, not tracking) — the hosted
policy has to say the same thing.

---

## Prerequisites

- Apple Developer Program membership ($99/yr), active
- An App ID for `com.remycamera.alerts`
- An **APNs key** (`.p8`) — the same one `server/` uses
- Node from `.nvmrc`: `nvm use`

```bash
npm install -g eas-cli
eas login
eas init            # fills in extra.eas.projectId in app.json
```

Then replace the placeholders in `eas.json` → `submit.production.ios`:
`ascAppId` (App Store Connect → App Information → Apple ID) and `appleTeamId`.

## Build

```bash
eas build --profile production --platform ios
```

EAS handles signing and increments the build number remotely
(`appVersionSource: "remote"`). Bump the marketing version in `app.json`
(`expo.version`) by hand for each release users should see as new.

### Building locally instead

```bash
REMY_CRITICAL_ALERTS=1 npx expo prebuild --clean   # omit the env var pre-approval
open ios/RemyAlerts.xcworkspace
```

Then Product → Archive → Distribute App. Use the `.xcworkspace`, never the
`.xcodeproj` — CocoaPods.

## Submit

```bash
eas submit --profile production --platform ios --latest
```

Uploads the most recent build to App Store Connect. From there: TestFlight for
testing, or fill in metadata and submit for review.

## App Store Connect metadata

Push-notification apps draw extra scrutiny, and critical alerts more so. Be
explicit rather than minimal.

- **Category**: Medical, or Health & Fitness
- **Age rating**: 4+
- **Encryption**: already declared via `ITSAppUsesNonExemptEncryption: false` —
  the app uses only HTTPS, which is exempt
- **Screenshots**: 6.7" and 6.5" iPhone required. The alert feed with a few
  realistic entries, plus the Settings screen showing delivery status.
- **Review notes** — write these, they matter here:

  > Remy Alerts notifies family caregivers about safety events from Reolink
  > cameras in a relative's home (overnight door activity, stove-area activity).
  >
  > The alert feed is populated by our backend. We have seeded the review
  > account with sample alerts so the feed is not empty.
  >
  > To see a live notification: open Settings inside the app and tap "Send test
  > critical alert". This delivers a real push to the device.
  >
  > [If submitting with the entitlement] This app uses the Critical Alerts
  > entitlement, approved by Apple on <date>, to notify caregivers of overnight
  > wandering and stove-safety events that could indicate immediate danger.

**Seed the review environment with sample alerts.** A reviewer who opens the app
to an empty "All quiet" screen has no way to tell a working app from a broken
one, and will assume broken.

## Release checklist

- [ ] `https://alerts.remycamera.com/health` reachable from outside your network
- [ ] Production APNs key installed server-side, `APNS_USE_SANDBOX=false`
- [ ] Sample alerts seeded so the feed is not empty
- [ ] `npm run typecheck` clean
- [ ] `expo.version` bumped in `app.json`
- [ ] `eas.json` placeholders replaced
- [ ] Privacy policy URL live
- [ ] Correct build profile for your entitlement status
- [ ] Installed from TestFlight and tested on a real phone first

### One thing that will bite you

**TestFlight and App Store builds use production APNs, not sandbox.** A build
that pushed fine in development will go silent the moment it comes from
TestFlight unless the server has `APNS_USE_SANDBOX=false`. `GET /health` reports
which environment the server is configured for — check it after deploying.
