import { randomUUID } from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

const KEY = 'remy.device_id';

/**
 * Stable per-install identifier, so re-registering after an APNs token rotation
 * updates the existing row instead of creating a duplicate device.
 *
 * Uses expo-crypto rather than globalThis.crypto — Hermes does not ship a Web
 * Crypto global.
 */
export async function getDeviceId(): Promise<string> {
  const existing = await SecureStore.getItemAsync(KEY);
  if (existing) return existing;

  const id = randomUUID();
  await SecureStore.setItemAsync(KEY, id);
  return id;
}
