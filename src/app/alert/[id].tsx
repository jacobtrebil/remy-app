import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { humanizeCategory, severityOf, severityStyle } from '@/constants/severity';
import { Spacing } from '@/constants/theme';
import { useSites } from '@/hooks/use-sites';
import { useTheme } from '@/hooks/use-theme';
import { acknowledgeEvent, fetchEvent } from '@/lib/remy-api';
import type { RemyEvent } from '@/lib/types';

export default function EventDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const { site } = useSites();

  const [event, setEvent] = useState<RemyEvent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [acking, setAcking] = useState(false);

  const eventId = Number(id);

  useEffect(() => {
    if (!site || !Number.isFinite(eventId)) return;
    fetchEvent(site, eventId)
      .then(setEvent)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, [site, eventId]);

  const onAcknowledge = useCallback(async () => {
    if (!site || !event) return;
    setAcking(true);
    try {
      await acknowledgeEvent(site, event.id);
      // The site returns feedback, not the event, so reflect the change locally.
      setEvent({ ...event, reviewed: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setAcking(false);
    }
  }, [site, event]);

  if (error) {
    return (
      <View style={styles.center}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
          {error}
        </ThemedText>
      </View>
    );
  }

  if (!event) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  const severity = severityStyle(severityOf(event));

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
      <View style={[styles.badge, { backgroundColor: severity.tint }]}>
        <ThemedText type="smallBold" style={{ color: severity.color }}>
          {severity.label}
        </ThemedText>
      </View>

      <ThemedText type="subtitle">
        {event.title || humanizeCategory(event.remy_category)}
      </ThemedText>

      {event.thumbnail_url ? (
        <Image source={{ uri: event.thumbnail_url }} style={styles.image} contentFit="cover" />
      ) : null}

      {event.ai_summary ? (
        <ThemedText type="default" themeColor="textSecondary">
          {event.ai_summary}
        </ThemedText>
      ) : null}

      {event.uncertainty_reason ? (
        <View style={[styles.note, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            Remy is not certain
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {event.uncertainty_reason}
          </ThemedText>
        </View>
      ) : null}

      <View style={[styles.meta, { backgroundColor: theme.backgroundElement }]}>
        <Row label="Room" value={humanizeCategory(event.room)} />
        <Row label="Category" value={humanizeCategory(event.remy_category)} />
        <Row label="When" value={new Date(event.start_time).toLocaleString()} />
        {event.confidence ? <Row label="Confidence" value={event.confidence} /> : null}
        <Row label="Reviewed" value={event.reviewed ? 'Yes' : 'Not yet'} />
      </View>

      {!event.reviewed ? (
        <Pressable
          onPress={onAcknowledge}
          disabled={acking}
          style={[styles.primary, { backgroundColor: severity.color, opacity: acking ? 0.6 : 1 }]}>
          <ThemedText type="default" style={styles.primaryText}>
            {acking ? 'Marking reviewed…' : 'Mark reviewed'}
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
      <ThemedText type="small" style={styles.rowValue}>
        {value}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.three, gap: Spacing.three },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four },
  centered: { textAlign: 'center' },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: 6,
  },
  image: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 12,
    backgroundColor: 'rgba(127,127,127,0.15)',
  },
  note: { borderRadius: 12, padding: Spacing.three, gap: Spacing.half },
  meta: { borderRadius: 12, padding: Spacing.three, gap: Spacing.two },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.three },
  rowValue: { flexShrink: 1, textAlign: 'right' },
  primary: { alignItems: 'center', paddingVertical: Spacing.three, borderRadius: 12 },
  primaryText: { color: '#ffffff', fontWeight: '600' },
});
