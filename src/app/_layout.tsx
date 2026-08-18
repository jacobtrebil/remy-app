import { DarkTheme, DefaultTheme, Stack, ThemeProvider, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, useColorScheme, View } from 'react-native';

import { useSession } from '@/hooks/use-session';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const { session, loading } = useSession();

  useAuthGate(session !== null, loading);

  if (loading) {
    // Reading the stored session is fast; a spinner beats flashing sign-in.
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerLargeTitle: true }}>
        <Stack.Screen name="sign-in" options={{ headerShown: false }} />
        <Stack.Screen name="index" options={{ title: 'Safety Alerts' }} />
        <Stack.Screen name="alert/[id]" options={{ title: 'Event', headerLargeTitle: false }} />
        <Stack.Screen
          name="settings"
          options={{ title: 'Settings', presentation: 'modal', headerLargeTitle: false }}
        />
      </Stack>
    </ThemeProvider>
  );
}

/** Bounce to sign-in when signed out, and back to the feed once signed in. */
function useAuthGate(signedIn: boolean, loading: boolean) {
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const onSignIn = segments[0] === 'sign-in';

    if (!signedIn && !onSignIn) {
      router.replace('/sign-in');
    } else if (signedIn && onSignIn) {
      router.replace('/');
    }
  }, [signedIn, loading, segments, router]);
}
