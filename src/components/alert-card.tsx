import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { humanizeCategory, severityOf, severityStyle } from '@/constants/severity';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { RemyEvent } from '@/lib/types';

export function AlertCard({ event, onPress }: { event: RemyEvent; onPress?: () => void }) {
  const theme = useTheme();
  const severity = severityStyle(severityOf(event));

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement,
          borderLeftColor: severity.color,
          opacity: event.reviewed ? 0.6 : 1,
        },
      ]}>
      <View style={styles.row}>
        <View style={styles.main}>
          <View style={styles.header}>
            <View style={[styles.badge, { backgroundColor: severity.tint }]}>
              <ThemedText type="smallBold" style={[styles.badgeText, { color: severity.color }]}>
                {severity.label}
              </ThemedText>
            </View>
            <ThemedText type="small" themeColor="textSecondary">
              {formatTime(event.start_time)}
            </ThemedText>
          </View>

          <ThemedText type="default" style={styles.title} numberOfLines={2}>
            {event.title || humanizeCategory(event.remy_category)}
          </ThemedText>

          {event.ai_summary ? (
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={3}>
              {event.ai_summary}
            </ThemedText>
          ) : null}

          <View style={styles.footer}>
            <ThemedText type="small" themeColor="textSecondary">
              {humanizeCategory(event.room)}
            </ThemedText>
            {event.reviewed ? (
              <ThemedText type="small" themeColor="textSecondary">
                Reviewed
              </ThemedText>
            ) : null}
          </View>
        </View>

        {event.thumbnail_url ? (
          <Image
            source={{ uri: event.thumbnail_url }}
            style={styles.thumbnail}
            contentFit="cover"
            transition={150}
          />
        ) : null}
      </View>
    </Pressable>
  );
}

/** "3:42 PM" for today, "Mar 4, 3:42 PM" otherwise. */
function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  const sameDay = date.toDateString() === new Date().toDateString();
  return date.toLocaleString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    ...(sameDay ? {} : { month: 'short', day: 'numeric' }),
  });
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderLeftWidth: 4,
    padding: Spacing.three,
  },
  row: { flexDirection: 'row', gap: Spacing.three },
  main: { flex: 1, gap: Spacing.one },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.one,
  },
  badge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: 6,
  },
  badgeText: { fontSize: 11, letterSpacing: 0.6 },
  title: { fontWeight: '600' },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.one,
  },
  thumbnail: {
    width: 72,
    height: 72,
    borderRadius: 10,
    backgroundColor: 'rgba(127,127,127,0.15)',
  },
});
