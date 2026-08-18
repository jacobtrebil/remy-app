import { Link, router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';

import { AlertCard } from '@/components/alert-card';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useSites } from '@/hooks/use-sites';
import { useTheme } from '@/hooks/use-theme';
import { IS_CONFIGURED } from '@/lib/config';
import { fetchSafetyAlerts } from '@/lib/remy-api';
import type { RemyEvent, Site } from '@/lib/types';

export default function SafetyAlertFeed() {
  const theme = useTheme();
  const { site, sites, loading: sitesLoading, error: sitesError, refresh: refreshSites } = useSites();

  const [events, setEvents] = useState<RemyEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (target: Site | null) => {
    if (!target) {
      setEvents(null);
      return;
    }
    try {
      setEvents(await fetchSafetyAlerts(target));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  // Reload on focus so acknowledging an event updates the list behind it.
  useFocusEffect(
    useCallback(() => {
      void load(site);
    }, [load, site])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshSites();
    await load(site);
    setRefreshing(false);
  }, [load, refreshSites, site]);

  return (
    <FlatList
      data={events ?? []}
      keyExtractor={(item) => String(item.id)}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListHeaderComponent={
        <View style={styles.header}>
          {site ? (
            <ThemedText type="small" themeColor="textSecondary">
              {site.name}
              {sites && sites.length > 1 ? ' · tap Settings to switch home' : ''}
            </ThemedText>
          ) : null}
          <Link href="/settings" asChild>
            <Pressable
              style={StyleSheet.flatten([
                styles.settings,
                { backgroundColor: theme.backgroundElement },
              ])}>
              <ThemedText type="small">Settings</ThemedText>
            </Pressable>
          </Link>
        </View>
      }
      ListEmptyComponent={
        <Empty
          loading={sitesLoading || (site !== null && events === null && !error)}
          error={sitesError ?? error}
          hasSite={site !== null}
          onRetry={() => {
            void refreshSites();
            void load(site);
          }}
        />
      }
      renderItem={({ item }) => (
        <AlertCard
          event={item}
          onPress={() => router.push({ pathname: '/alert/[id]', params: { id: String(item.id) } })}
        />
      )}
    />
  );
}

function Empty({
  loading,
  error,
  hasSite,
  onRetry,
}: {
  loading: boolean;
  error: string | null;
  hasSite: boolean;
  onRetry: () => void;
}) {
  if (loading) {
    return (
      <View style={styles.empty}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!IS_CONFIGURED) {
    return (
      <View style={styles.empty}>
        <ThemedText type="default">Not configured</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
          Set EXPO_PUBLIC_CONTROL_PLANE_URL to the deployed Remy control plane and rebuild.
        </ThemedText>
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

  if (!hasSite) {
    return (
      <View style={styles.empty}>
        <ThemedText type="default">No homes yet</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
          You don&apos;t have access to any homes. Ask the home&apos;s owner to invite you.
        </ThemedText>
      </View>
    );
  }

  return (
    <View style={styles.empty}>
      <ThemedText type="default">All quiet</ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
        Nothing needs your review right now.
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.three, gap: Spacing.two },
  header: { gap: Spacing.two, marginBottom: Spacing.one },
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
  centered: { textAlign: 'center' },
});
