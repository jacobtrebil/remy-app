import { useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { severityStyle } from '@/constants/severity';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { acknowledgeAlert, fetchAlert } from '@/lib/api';
import type { Alert } from '@/lib/types';

export default function AlertDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const [alert, setAlert] = useState<Alert | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [acking, setAcking] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetchAlert(id)
      .then(setAlert)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, [id]);

  const onAcknowledge = useCallback(async () => {
    if (!id) return;
    setAcking(true);
    try {
      setAlert(await acknowledgeAlert(id));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setAcking(false);
    }
  }, [id]);

  if (error) {
    return (
      <View style={styles.center}>
        <ThemedText type="small" themeColor="textSecondary">
          {error}
        </ThemedText>
      </View>
    );
  }

  if (!alert) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  const severity = severityStyle(alert.severity);
  const acknowledged = alert.acknowledged_at !== null;

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
      <View style={[styles.badge, { backgroundColor: severity.tint }]}>
        <ThemedText type="smallBold" style={{ color: severity.color }}>
          {severity.label}
        </ThemedText>
      </View>

      <ThemedText type="subtitle">{alert.title}</ThemedText>
      <ThemedText type="default" themeColor="textSecondary">
        {alert.body}
      </ThemedText>

      <View style={[styles.meta, { backgroundColor: theme.backgroundElement }]}>
        <Row label="Source" value={alert.source ?? '—'} />
        <Row label="Received" value={new Date(alert.created_at).toLocaleString()} />
        <Row
          label="Acknowledged"
          value={acknowledged ? new Date(alert.acknowledged_at!).toLocaleString() : 'Not yet'}
        />
      </View>

      {alert.event_url ? (
        <Pressable
          onPress={() => WebBrowser.openBrowserAsync(alert.event_url!)}
          style={[styles.secondary, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText type="default">View camera event</ThemedText>
        </Pressable>
      ) : null}

      {!acknowledged ? (
        <Pressable
          onPress={onAcknowledge}
          disabled={acking}
          style={[styles.primary, { backgroundColor: severity.color, opacity: acking ? 0.6 : 1 }]}>
          <ThemedText type="default" style={styles.primaryText}>
            {acking ? 'Acknowledging…' : 'Acknowledge'}
          </ThemedText>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="small">{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: Spacing.three,
    gap: Spacing.three,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: 6,
  },
  meta: {
    borderRadius: 12,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  primary: {
    alignItems: 'center',
    paddingVertical: Spacing.three,
    borderRadius: 12,
  },
  primaryText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  secondary: {
    alignItems: 'center',
    paddingVertical: Spacing.three,
    borderRadius: 12,
  },
});
