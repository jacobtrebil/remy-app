# Shipping Remy Alerts to the App Store

This app is **already a native iOS app**. `npx expo prebuild` generates a real
Xcode project in `ios/` that compiles to a normal `.ipa` — there is no web view
and nothing to wrap.

---

## Blockers to clear first

Ordered by how likely they are to sink the submission.

### 1. The control-plane URL must be set

`eas.json` still carries a placeholder:

```
EXPO_PUBLIC_CONTROL_PLANE_URL: https://REPLACE-WITH-CONTROL-PLANE.up.railway.app
```

That is the only backend URL the app needs — every home's endpoint comes back
from `GET /me/sites`. Replace it in all four build profiles with the deployed
Railway address, and confirm `/health` answers from outside your network before
you submit.

App Review runs the app on a device in California. A reviewer who signs in and
sees "Not configured" or a connection error is a **Guideline 2.1 — App
Completeness** rejection.

### 2. The reviewer needs an account with a home on it

There is no anonymous mode. A reviewer who signs in to an empty account sees "No
homes yet" and cannot evaluate the app.

Create a demo Remy account, grant it access to a home with real (or realistic)
events, and put the credentials in App Store Connect → **App Review Information
→ Sign-In Required**. Verify the events are actually visible to *that* account,
not just yours — access is grant-scoped, so an untested demo account is the
classic way this fails.

### 3. Privacy policy URL

The app signs users in and reads camera-derived event summaries, so App Store
Connect requires a privacy policy URL. `app.config.ts` declares the matching
privacy manifest — the hosted policy must agree with it.

Note that the app itself collects nothing new: it reads what the caregiver
already has access to on the web. The policy should reflect the backend's data
practices, not describe the app as a separate collector.

### 4. Camera and health framing

The listing describes monitoring a relative's home. Be straightforward that
alerts derive from cameras the household already installed, that the app shows
summaries rather than a live feed, and that it is not a medical device. Vague
health claims invite a **Guideline 1.4.1** round trip.

---

## Prerequisites

- Apple Developer Program membership ($99/yr), active
- An App ID for `com.remycamera.alerts`
- Node from `.nvmrc`: `nvm use`

```bash
npm install -g eas-cli
eas login
eas init            # fills in extra.eas.projectId in app.json
```

`eas submit` resolves the App Store Connect app and team interactively, so there
is nothing else to fill in beyond the control-plane URL.

## Build

```bash
eas build --profile production --platform ios
```

EAS handles signing and increments the build number remotely
(`appVersionSource: "remote"`). Bump `expo.version` in `app.json` by hand for
each release users should see as new.

**Use `production`, not `production-critical`.** The latter requests the Apple
Critical Alerts entitlement, which fails signing until Apple grants it — and the
app does not send pushes yet regardless. See the Push section in the README.

### Building locally instead

```bash
npx expo prebuild --clean
open ios/RemyAlerts.xcworkspace
```

Product → Archive → Distribute App. Use the `.xcworkspace`, never the
`.xcodeproj` — CocoaPods.

## TestFlight

```bash
eas submit --profile production --platform ios --latest
```

Uploads the latest build; Apple processes it in 5–15 minutes. Then App Store
Connect → **TestFlight** → **Internal Testing** → create a group → add testers
by Apple ID. Internal testers (up to 100, on your team) get it immediately with
**no review**. External testers need a review round.

For putting it on your own family's phones, internal TestFlight is the whole
answer — no review, no privacy policy, no store listing.

## App Store Connect metadata

- **Category**: Medical, or Health & Fitness
- **Age rating**: 4+
- **Encryption**: already declared via `ITSAppUsesNonExemptEncryption: false` —
  the app uses only HTTPS, which is exempt
- **Screenshots**: 6.7" and 6.5" iPhone required. The alert feed with a few
  realistic entries, plus an event detail screen.
- **Sign-in required**: yes — supply the demo account from blocker 2
- **Review notes**:

  > Remy Alerts shows family caregivers the safety events Remy flags from
  > cameras in a relative's home (overnight door activity, stove-area activity).
  >
  > Sign in with the demo account provided. It has access to a home with sample
  > events, which appear on the main screen. Tap any event for detail and to
  > mark it reviewed.
  >
  > The app does not send push notifications in this version.

## Release checklist

- [ ] `EXPO_PUBLIC_CONTROL_PLANE_URL` replaced in all four `eas.json` profiles
- [ ] Control plane reachable from outside your network
- [ ] Demo account created, granted a home, and **verified to show events**
- [ ] `npm run typecheck` clean
- [ ] `expo.version` bumped in `app.json`
- [ ] Privacy policy URL live
- [ ] Built with `production` (not `production-critical`)
- [ ] Installed from TestFlight and tested on a real phone first

### When push is added later

**TestFlight and App Store builds use production APNs, not sandbox** — a build
that pushed fine in development goes silent from TestFlight unless the sending
service is configured for production. That one catches everybody.
