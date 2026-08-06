import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { RegistrationState } from '@/hooks/use-alert-registration';

type Props = RegistrationState & {
  onPrompt: () => void;
};

/**
 * The one thing a caregiver needs to see at a glance: whether a critical alert
 * would actually reach them right now. Silent when everything is wired up.
 */
export function StatusBanner({ permissions, error, registered, busy, onPrompt }: Props) {
  if (busy && !permissions) return null;

  const state = resolve({ permissions, error, registered });
  if (!state) return null;

  return (
    <View style={[styles.banner, { backgroundColor: state.tint, borderColor: state.color }]}>
      <View style={styles.text}>
        <ThemedText type="smallBold" style={{ color: state.color }}>
          {state.title}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {state.body}
        </ThemedText>
      </View>
      {state.action ? (
        <Pressable onPress={onPrompt} style={[styles.action, { backgroundColor: state.color }]}>
          <ThemedText type="smallBold" style={styles.actionText}>
            {state.action}
          </ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
}

function resolve({ permissions, error, registered }: Omit<Props, 'onPrompt' | 'busy'>) {
  const RED = { color: '#D93025', tint: 'rgba(217, 48, 37, 0.10)' };
  const AMBER = { color: '#E8890C', tint: 'rgba(232, 137, 12, 0.10)' };

  if (permissions && !permissions.granted) {
    return {
      ...RED,
      title: 'Notifications are off',
      body: 'Remy cannot reach you. Turn on notifications to receive critical alerts.',
      action: permissions.canAskAgain ? 'Enable' : undefined,
    };
  }

  if (permissions?.granted && !permissions.criticalGranted) {
    return {
      ...AMBER,
      title: 'Critical alerts not enabled',
      body: 'Alerts will be silenced by Do Not Disturb and the ringer switch.',
      action: 'Enable',
    };
  }

  if (error) {
    return { ...AMBER, title: 'Not connected', body: error, action: 'Retry' };
  }

  if (!registered) {
    return { ...AMBER, title: 'Device not registered', body: 'Alerts may not arrive.', action: 'Retry' };
  }

  return null;
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  text: {
    flex: 1,
    gap: Spacing.half,
  },
  action: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 8,
  },
  actionText: {
    color: '#ffffff',
  },
});
