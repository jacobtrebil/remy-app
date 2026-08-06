import { DarkTheme, DefaultTheme, Stack, ThemeProvider, router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { clearBadge } from '@/lib/notifications';
import type { AlertPushData } from '@/lib/types';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useNotificationTaps();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerLargeTitle: true }}>
        <Stack.Screen name="index" options={{ title: 'Alerts' }} />
        <Stack.Screen name="alert/[id]" options={{ title: 'Alert', headerLargeTitle: false }} />
        <Stack.Screen
          name="settings"
          options={{ title: 'Settings', presentation: 'modal', headerLargeTitle: false }}
        />
      </Stack>
    </ThemeProvider>
  );
}

/**
 * Routes a notification tap to the alert it came from, covering both cases:
 * the app already running, and the app launched cold by the tap.
 */
function useNotificationTaps() {
  useEffect(() => {
    let cancelled = false;

    function open(response: Notifications.NotificationResponse | null) {
      const data = response?.notification.request.content.data as AlertPushData | undefined;
      if (!cancelled && data?.alert_id) {
        router.push({ pathname: '/alert/[id]', params: { id: data.alert_id } });
      }
    }

    // Cold start: the tap that launched the app is waiting for us here.
    Notifications.getLastNotificationResponseAsync().then(open);

    const subscription = Notifications.addNotificationResponseReceivedListener(open);
    void clearBadge();

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, []);
}
