import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/config';

/**
 * Supabase client, sharing the identity layer with the remy-camera web app —
 * the same account signs into both.
 *
 * Sessions live in AsyncStorage rather than expo-secure-store: SecureStore caps
 * a value at 2048 bytes and a Supabase session (access + refresh token plus user
 * claims) regularly exceeds that, failing to persist and silently signing the
 * user out on next launch.
 */
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // There is no URL to parse a session out of in a native app.
    detectSessionInUrl: false,
  },
});

/**
 * A valid access token, refreshing it if it is close to expiry.
 *
 * Every call into the control plane and the site instances needs one; both
 * verify it against Supabase's JWKS.
 */
export async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}
