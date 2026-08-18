import Constants from 'expo-constants';

/**
 * Supabase project — the same identity used by the remy-camera web app.
 * Both values are publishable and safe to ship in the bundle.
 */
export const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://eausnsqtrtxwngxwvqlc.supabase.co';

export const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? 'sb_publishable_8GtALjLP4uYpOL_ETLZVig_cRX1DNH4';

/**
 * The deployed control plane, which owns the site registry and answers
 * GET /me/sites for the signed-in caregiver. Each site it returns carries its
 * own `endpoint`, so this is the only backend URL the app needs configured.
 */
export const CONTROL_PLANE_URL = (process.env.EXPO_PUBLIC_CONTROL_PLANE_URL ?? '').replace(
  /\/$/,
  ''
);

/** False until EXPO_PUBLIC_CONTROL_PLANE_URL is set; the UI says so rather than failing obscurely. */
export const IS_CONFIGURED = CONTROL_PLANE_URL.length > 0;

export const APP_VERSION = Constants.expoConfig?.version ?? '0.0.0';
