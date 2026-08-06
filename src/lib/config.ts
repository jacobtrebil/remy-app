import Constants from 'expo-constants';

/**
 * Base URL of the push service in `server/`.
 *
 * Set EXPO_PUBLIC_API_URL in .env (see .env.example). On a physical device
 * `localhost` points at the phone, so during development this needs to be your
 * Mac's LAN address — Expo hands us the dev-server host, which we fall back to.
 */
function resolveApiUrl(): string {
  const explicit = process.env.EXPO_PUBLIC_API_URL;
  if (explicit) return explicit.replace(/\/$/, '');

  // hostUri looks like "192.168.1.24:8081" when running `expo start`.
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  if (host) return `http://${host}:8000`;

  return 'http://localhost:8000';
}

export const API_URL = resolveApiUrl();

/**
 * Shared secret for the device-facing endpoints. This is a low-value token that
 * only gates registration and reads — the p8 signing key that can actually send
 * pushes lives on the server and never ships in the bundle.
 */
export const API_KEY = process.env.EXPO_PUBLIC_API_KEY ?? '';

export const APP_VERSION = Constants.expoConfig?.version ?? '0.0.0';
