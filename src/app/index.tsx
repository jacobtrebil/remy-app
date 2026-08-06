import * as Notifications from 'expo-notifications';
import { Link, router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { AlertCard } from '@/components/alert-card';
import { StatusBanner } from '@/components/status-banner';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAlertRegistration } from '@/hooks/use-alert-registration';
import { useTheme } from '@/hooks/use-theme';
import { fetchAlerts } from '@/lib/api';
import type { Alert } from '@/lib/types';

export default function AlertFeed() {
  const theme = useTheme();
  const registration = useAlertRegistration();
  const [alerts, setAlerts] = useState<Alert[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setAlerts(await fetchAlerts());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  // Refresh whenever the feed comes back into view (e.g. after acknowledging).
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  // A push arriving while the app is open should update the list behind it.
  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener(() => void load());
    return () => sub.remove();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([load(), registration.refresh()]);
    setRefreshing(false);
  }, [load, registration]);

  return (
    <FlatList
      data={alerts ?? []}
      keyExtractor={(item) => item.id}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListHeaderComponent={
        <View style={styles.header}>
          <StatusBanner {...registration} onPrompt={registration.prompt} />
          <Link href="/settings" asChild>
            <Pressable style={[styles.settings, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText type="small">Settings &amp; test alert</ThemedText>
            </Pressable>
          </Link>
        </View>
      }
      ListEmptyComponent={
        <Empty loading={alerts === null && !error} error={error} onRetry={load} />
      }
      renderItem={({ item }) => (
        <AlertCard alert={item} onPress={() => router.push(`/alert/${item.id}`)} />
      )}
    />
  );
}

function Empty({
  loading,
  error,
  onRetry,
}: {
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  if (loading) {
    return (
      <View style={styles.empty}>
        <ActivityIndicator />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.empty}>
        <ThemedText type="default">Couldn&apos;t load alerts</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
          {error}
        </ThemedText>
        <Pressable onPress={onRetry}>
          <ThemedText type="linkPrimary">Try again</ThemedText>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.empty}>
      <ThemedText type="default">All quiet</ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
        Alerts from your Remy cameras will appear here.
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: Spacing.three,
    gap: Spacing.two,
  },
  header: {
    gap: Spacing.two,
    marginBottom: Spacing.one,
  },
  settings: {
    alignItems: 'center',
    paddingVertical: Spacing.three,
    borderRadius: 12,
  },
  empty: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingTop: Spacing.six,
  },
  centered: {
    textAlign: 'center',
  },
});
