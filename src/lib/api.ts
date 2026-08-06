import { API_KEY, API_URL, APP_VERSION } from '@/lib/config';
import { getDeviceId } from '@/lib/device-id';
import type { Alert, DeviceRegistration } from '@/lib/types';

class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        'content-type': 'application/json',
        ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
        ...init.headers,
      },
    });
  } catch {
    // status 0 = never reached the server, as opposed to a real HTTP failure.
    throw new ApiError(0, `Can't reach the alert service at ${API_URL}`);
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new ApiError(res.status, detail || `${res.status} ${res.statusText}`);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** Idempotent — safe to call on every launch and whenever the APNs token rotates. */
export async function registerDevice(params: {
  pushToken: string;
  platform: 'ios' | 'android';
  criticalAlertsGranted: boolean;
}): Promise<DeviceRegistration> {
  const deviceId = await getDeviceId();
  return request<DeviceRegistration>('/api/devices', {
    method: 'POST',
    body: JSON.stringify({
      device_id: deviceId,
      push_token: params.pushToken,
      platform: params.platform,
      critical_alerts_granted: params.criticalAlertsGranted,
      app_version: APP_VERSION,
    }),
  });
}

export async function fetchAlerts(limit = 50): Promise<Alert[]> {
  return request<Alert[]>(`/api/alerts?limit=${limit}`);
}

export async function fetchAlert(id: string): Promise<Alert> {
  return request<Alert>(`/api/alerts/${id}`);
}

export async function acknowledgeAlert(id: string): Promise<Alert> {
  return request<Alert>(`/api/alerts/${id}/ack`, { method: 'POST' });
}

/**
 * Fires a real critical alert at this device. Lock the phone and flip the mute
 * switch first — that is the only way to verify the entitlement actually works.
 */
export async function sendTestAlert(): Promise<void> {
  const deviceId = await getDeviceId();
  await request('/api/alerts/test', {
    method: 'POST',
    body: JSON.stringify({ device_id: deviceId }),
  });
}

export { ApiError };
