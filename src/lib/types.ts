/** Shapes shared with the `server/` push service. Keep in sync with server/app/schemas.py. */

/**
 * Only `critical` triggers an Apple Critical Alert (bypasses silent mode / Focus).
 * Everything else is delivered as an ordinary notification.
 */
export type Severity = 'critical' | 'warning' | 'info';

export type Alert = {
  id: string;
  severity: Severity;
  title: string;
  body: string;
  /** Which camera / zone produced this, e.g. "Kitchen" or "Front Door". */
  source: string | null;
  /** ISO-8601 UTC. */
  created_at: string;
  /** ISO-8601 UTC, set once someone taps through and acknowledges. */
  acknowledged_at: string | null;
  /** Deep link back into the remy-camera web app for the underlying event. */
  event_url: string | null;
};

export type DeviceRegistration = {
  device_id: string;
  /** Raw APNs device token (hex), not an Expo push token. */
  push_token: string;
  platform: 'ios' | 'android';
  /** Whether the user actually granted the critical-alert entitlement prompt. */
  critical_alerts_granted: boolean;
  app_version: string;
};

/** `data` block carried on every push we send, used to route the tap. */
export type AlertPushData = {
  alert_id: string;
  severity: Severity;
};
