import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { severityStyle } from '@/constants/severity';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Alert } from '@/lib/types';

export function AlertCard({ alert, onPress }: { alert: Alert; onPress?: () => void }) {
  const theme = useTheme();
  const severity = severityStyle(alert.severity);
  const acknowledged = alert.acknowledged_at !== null;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement,
          borderLeftColor: severity.color,
          opacity: acknowledged ? 0.6 : 1,
        },
      ]}>
      <View style={styles.header}>
        <View style={[styles.badge, { backgroundColor: severity.tint }]}>
          <ThemedText type="smallBold" style={[styles.badgeText, { color: severity.color }]}>
            {severity.label}
          </ThemedText>
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          {formatTime(alert.created_at)}
        </ThemedText>
      </View>

      <ThemedText type="default" style={styles.title}>
        {alert.title}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {alert.body}
      </ThemedText>

      <View style={styles.footer}>
        {alert.source ? (
          <ThemedText type="small" themeColor="textSecondary">
            {alert.source}
          </ThemedText>
        ) : null}
        {acknowledged ? (
          <ThemedText type="small" themeColor="textSecondary">
            Acknowledged
          </ThemedText>
        ) : null}
      </View>
    </Pressable>
  );
}

/** "3:42 PM" for today, "Mar 4, 3:42 PM" otherwise. */
function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
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
    gap: Spacing.one,
  },
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
  badgeText: {
    fontSize: 11,
    letterSpacing: 0.6,
  },
  title: {
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.one,
  },
});
