import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { registerDevice } from '@/lib/api';
import {
  getDevicePushToken,
  getPermissionState,
  requestPermissions,
  type PermissionState,
} from '@/lib/notifications';

export type RegistrationState = {
  permissions: PermissionState | null;
  pushToken: string | null;
  /** Set when we have a token but the server rejected or never saw it. */
  error: string | null;
  registered: boolean;
  busy: boolean;
};

const INITIAL: RegistrationState = {
  permissions: null,
  pushToken: null,
  error: null,
  registered: false,
  busy: true,
};

/**
 * Owns the permission -> APNs token -> server registration chain.
 *
 * Runs on mount so a returning user re-registers after an OS token rotation,
 * and exposes `prompt()` for the explicit "Enable critical alerts" button.
 */
export function useAlertRegistration() {
  const [state, setState] = useState<RegistrationState>(INITIAL);

  const sync = useCallback(async (ask: boolean) => {
    setState((s) => ({ ...s, busy: true, error: null }));
    try {
      const permissions = ask ? await requestPermissions() : await getPermissionState();

      if (!permissions.granted) {
        setState({ permissions, pushToken: null, error: null, registered: false, busy: false });
        return;
      }

      const pushToken = await getDevicePushToken();
      if (!pushToken) {
        setState({
          permissions,
          pushToken: null,
          // The usual cause: running in a simulator, which APNs never targets.
          error: 'No push token — critical alerts need a physical device.',
          registered: false,
          busy: false,
        });
        return;
      }

      await registerDevice({
        pushToken,
        platform: Platform.OS === 'android' ? 'android' : 'ios',
        criticalAlertsGranted: permissions.criticalGranted,
      });

      setState({ permissions, pushToken, error: null, registered: true, busy: false });
    } catch (err) {
      setState((s) => ({
        ...s,
        busy: false,
        registered: false,
        error: err instanceof Error ? err.message : String(err),
      }));
    }
  }, []);

  useEffect(() => {
    void sync(false);
  }, [sync]);

  return {
    ...state,
    /** Shows the iOS permission prompts, then registers. */
    prompt: useCallback(() => sync(true), [sync]),
    /** Re-checks permissions and re-registers without prompting. */
    refresh: useCallback(() => sync(false), [sync]),
  };
}
