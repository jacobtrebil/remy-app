import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Dynamic config layered over app.json.
 *
 * The one thing that genuinely has to vary per build is the critical-alerts
 * entitlement. Xcode refuses to sign a build requesting an entitlement your
 * App ID does not hold, so it must stay out until Apple approves the request —
 * but it has to go back in automatically the moment they do, or the App Store
 * build silently ships without the feature the app exists for.
 *
 *   REMY_CRITICAL_ALERTS=1 npx expo prebuild --clean
 *
 * eas.json sets it per build profile.
 */
const criticalAlertsApproved = process.env.REMY_CRITICAL_ALERTS === '1';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name ?? 'Remy Alerts',
  slug: config.slug ?? 'remy-app',
  ios: {
    ...config.ios,
    // CFBundleVersion. EAS manages this remotely (see appVersionSource in
    // eas.json); this value is the fallback for a local Xcode archive.
    buildNumber: '1',
    ...(criticalAlertsApproved
      ? {
          entitlements: {
            ...config.ios?.entitlements,
            'com.apple.developer.usernotifications.critical-alerts': true,
          },
        }
      : {}),
    privacyManifests: {
      NSPrivacyTracking: false,
      NSPrivacyTrackingDomains: [],
      NSPrivacyCollectedDataTypes: [
        {
          // The per-install UUID in expo-secure-store, sent to our own server so
          // a push can be addressed to this phone. Never leaves our backend.
          NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeDeviceID',
          NSPrivacyCollectedDataTypeLinked: false,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: [
            'NSPrivacyCollectedDataTypePurposeAppFunctionality',
          ],
        },
      ],
      NSPrivacyAccessedAPITypes: [
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryUserDefaults',
          NSPrivacyAccessedAPITypeReasons: ['CA92.1'],
        },
      ],
    },
  },
});
