# Remy Alerts

The iOS companion app for [remycamera.com](https://remycamera.com). A caregiver signs
in with their Remy account and sees the safety alerts from the homes they have
access to — the events Remy's pipeline flagged for review.

It reads the **existing** remy-camera backend. Nothing new to deploy.

```
                    ┌─ GET /me/sites ──────────┐
📱 Remy Alerts ─────┤  (Supabase JWT)          ├──▶ control plane
                    └─ GET /api/events/… ──────┴──▶ site instance (that home)
                       (Supabase JWT + X-Remy-Home)
```

| Path      | What it is                                                          |
| --------- | ------------------------------------------------------------------- |
| `src/`    | The app — sign-in, safety alert feed, event detail, home switcher    |
| `server/` | Standalone APNs push service, **not used yet** (see Push, below)     |

Shipping to the App Store: **[RELEASE.md](./RELEASE.md)**.

## How it fits together

The app carries no backend of its own. It borrows remy-camera's:

1. **Identity** — Supabase, the same account as the web app. One login for both.
2. **Which homes** — `GET {control-plane}/me/sites` returns each home the caregiver
   has a grant on, with their role and access level, plus that home's `endpoint`.
3. **The alerts** — `GET {site.endpoint}/api/events/needs-review`, sent with the
   Supabase JWT and `X-Remy-Home: {site.id}`. The site checks the grant with the
   control plane on every request, so access revocation takes effect in seconds.
4. **Acknowledging** — `POST /api/events/{id}/feedback` with
   `feedback_type: "reviewed"`, the one value that also sets `event.reviewed`.

Access control is entirely the backend's. The app never decides what someone may
see; it shows what the site returns for that caregiver's grant.

## Setup

Expo SDK 57 needs Node ≥ 20.19.4 — `.nvmrc` pins a known-good version.

```bash
nvm use
npm install
cp env.example .env
```

Then set **`EXPO_PUBLIC_CONTROL_PLANE_URL`** in `.env` to the deployed control
plane. That is the only value the app needs — every site URL comes back from
`/me/sites`. Without it the app says "Not configured" rather than failing oddly.
The Supabase project defaults are already baked into `src/lib/config.ts`.

```bash
npx expo run:ios --device
```

A physical device is not required for this app — everything works in the
simulator, since there are no push notifications yet.

## Severity

The backend has no severity field, so the app derives one from `remy_category`
in `src/constants/severity.ts`:

| Shown      | When                                                          |
| ---------- | ------------------------------------------------------------- |
| `SAFETY`   | stove safety, night exit, wandering, fall, fire, smoke        |
| `REVIEW`   | anything else with `needs_review`                             |
| `ACTIVITY` | everything else                                               |

If the pipeline gains categories, add them to `CRITICAL_CATEGORIES` — an unknown
category degrades to `REVIEW`, never silently to `ACTIVITY`.

## Push notifications — not wired up

The app does **not** send or receive push notifications yet. Settings says so
plainly rather than showing a permission toggle that does nothing.

`server/` holds a complete, working APNs service (device registry, HTTP/2 with
`.p8` provider tokens, critical-alert payloads) from when this app was going to
own its own backend. It is kept because it is the natural basis for adding push:

- **Apple Critical Alerts** need an entitlement Apple grants case by case —
  request it at
  <https://developer.apple.com/contact/request/notifications-critical-alerts>.
  `app.config.ts` adds the entitlement only when `REMY_CRITICAL_ALERTS=1`, since
  Xcode cannot sign a build requesting one the App ID lacks.
- Whatever sends the pushes needs to know which caregiver to notify, which is a
  control-plane concern (grants), not something the app can decide.

Until then the feed is pull-to-refresh.

## Gotchas

- **`.expo/types/router.d.ts` is committed**, unusually. `typedRoutes` makes
  `tsc` depend on it and there is no `expo typegen` to rebuild it without
  booting the dev server, so a clean clone could not typecheck otherwise. It
  regenerates on `expo start`; commit the change when routes change.
- **`types/expo.d.ts` is committed** for the same reason — Expo's generated
  `expo-env.d.ts` is gitignored, and without it CSS-module imports fail to
  typecheck on a clean clone.
- **A site that serves its web app from the same origin** answers unknown paths
  with `200` + `index.html`. `src/lib/remy-api.ts` checks the content type, so
  that surfaces as a clear message instead of a JSON parse error.
- **Sessions live in AsyncStorage, not SecureStore** — SecureStore caps values
  at 2048 bytes and a Supabase session exceeds that, which would silently sign
  the user out on every launch.
