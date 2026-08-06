import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/**
 * Foreground presentation. A critical alert that arrives while the app is open
 * should still make noise — that is the entire point of the entitlement — so we
 * never suppress the sound here.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export type PermissionState = {
  granted: boolean;
  /**
   * True only when Apple has approved the critical-alerts entitlement for this
   * build AND the user accepted the separate critical-alert prompt. If this is
   * false, `critical: 1` payloads are delivered as ordinary notifications and
   * will be silenced by Focus / the ringer switch.
   */
  criticalGranted: boolean;
  canAskAgain: boolean;
};

export async function getPermissionState(): Promise<PermissionState> {
  const perms = await Notifications.getPermissionsAsync();
  return toPermissionState(perms);
}

/**
 * Requests notification permission, including the critical-alert prompt.
 *
 * `allowCriticalAlerts` is silently ignored unless the build carries the
 * com.apple.developer.usernotifications.critical-alerts entitlement (see
 * app.json) — which Apple grants only after approving the request form linked
 * in the README. Without it the rest of the permissions still work.
 */
export async function requestPermissions(): Promise<PermissionState> {
  const existing = await Notifications.getPermissionsAsync();

  // Re-requesting after a grant is a no-op, but we still want the critical
  // prompt if the user granted normal notifications on an older build.
  if (existing.granted && toPermissionState(existing).criticalGranted) {
    return toPermissionState(existing);
  }

  const perms = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: true,
      allowSound: true,
      allowCriticalAlerts: true,
      // Lets a critical alert surface on the lock screen even in Do Not Disturb.
      provideAppNotificationSettings: true,
    },
  });

  return toPermissionState(perms);
}

function toPermissionState(perms: Notifications.NotificationPermissionsStatus): PermissionState {
  const ios = perms.ios;
  return {
    granted: perms.granted || ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL,
    criticalGranted: ios?.allowsCriticalAlerts === true,
    canAskAgain: perms.canAskAgain,
  };
}

/**
 * Returns the raw APNs device token (hex) — not an Expo push token.
 *
 * We deliberately talk to APNs directly from `server/`, because the Expo push
 * service does not forward the `sound.critical` flag.
 */
export async function getDevicePushToken(): Promise<string | null> {
  if (!Device.isDevice) {
    // Simulators never receive real pushes; there is no token to fetch.
    return null;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('critical', {
      name: 'Critical alerts',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'remy-critical.wav',
      vibrationPattern: [0, 400, 200, 400],
      bypassDnd: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  }

  const token = await Notifications.getDevicePushTokenAsync();
  return typeof token.data === 'string' ? token.data : null;
}

export async function clearBadge(): Promise<void> {
  await Notifications.setBadgeCountAsync(0);
}
