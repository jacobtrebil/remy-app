import * as SecureStore from 'expo-secure-store';

const KEY = 'remy.device_id';

/**
 * Stable per-install identifier, so re-registering after an APNs token rotation
 * updates the existing row instead of creating a duplicate device.
 */
export async function getDeviceId(): Promise<string> {
  const existing = await SecureStore.getItemAsync(KEY);
  if (existing) return existing;

  const id = globalThis.crypto.randomUUID();
  await SecureStore.setItemAsync(KEY, id);
  return id;
}
