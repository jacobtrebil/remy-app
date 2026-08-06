import * as Clipboard from 'expo-clipboard';
import { useCallback, useState, type ReactNode } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAlertRegistration } from '@/hooks/use-alert-registration';
import { useTheme } from '@/hooks/use-theme';
import { sendTestAlert } from '@/lib/api';
import { API_URL, APP_VERSION } from '@/lib/config';

export default function Settings() {
  const theme = useTheme();
  const registration = useAlertRegistration();
  const [testState, setTestState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  const [testError, setTestError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const onTest = useCallback(async () => {
    setTestState('sending');
    setTestError(null);
    try {
      await sendTestAlert();
      setTestState('sent');
    } catch (err) {
      setTestState('failed');
      setTestError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const onCopyToken = useCallback(async () => {
    if (!registration.pushToken) return;
    await Clipboard.setStringAsync(registration.pushToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [registration.pushToken]);

  const { permissions } = registration;

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
      <Section title="Delivery">
        <StatusRow
          label="Notifications"
          ok={permissions?.granted ?? false}
          value={permissions?.granted ? 'Allowed' : 'Not allowed'}
        />
        <StatusRow
          label="Critical alerts"
          ok={permissions?.criticalGranted ?? false}
          value={permissions?.criticalGranted ? 'Allowed' : 'Not allowed'}
        />
        <StatusRow
          label="Registered with server"
          ok={registration.registered}
          value={registration.registered ? 'Yes' : 'No'}
        />
      </Section>

      <ThemedText type="small" themeColor="textSecondary">
        Critical alerts play at full volume and bypass Do Not Disturb, Focus and the ringer switch.
        Remy only uses them for safety events — everything else arrives as a normal notification.
      </ThemedText>

      {!permissions?.criticalGranted ? (
        <Pressable
          onPress={permissions?.canAskAgain === false ? () => Linking.openSettings() : registration.prompt}
          style={[styles.button, styles.primary]}>
          <ThemedText type="default" style={styles.primaryText}>
            {permissions?.canAskAgain === false ? 'Open iOS Settings' : 'Enable critical alerts'}
          </ThemedText>
        </Pressable>
      ) : null}

      <Section title="Test">
        <ThemedText type="small" themeColor="textSecondary">
          Lock your phone, turn on Do Not Disturb and flip the mute switch, then send a test. If it
          rings anyway, critical alerts are working.
        </ThemedText>
        <Pressable
          onPress={onTest}
          disabled={testState === 'sending' || !registration.registered}
          style={[
            styles.button,
            { backgroundColor: theme.backgroundElement },
            (testState === 'sending' || !registration.registered) && styles.disabled,
          ]}>
          <ThemedText type="default">
            {testState === 'sending' ? 'Sending…' : 'Send test critical alert'}
          </ThemedText>
        </Pressable>
        {testState === 'sent' ? (
          <ThemedText type="small" themeColor="textSecondary">
            Sent — it should arrive within a few seconds.
          </ThemedText>
        ) : null}
        {testState === 'failed' && testError ? (
          <ThemedText type="small" style={styles.error}>
            {testError}
          </ThemedText>
        ) : null}
      </Section>

      <Section title="Diagnostics">
        <Row label="Server" value={API_URL} />
        <Row label="App version" value={APP_VERSION} />
        <Pressable onPress={onCopyToken} disabled={!registration.pushToken}>
          <Row
            label="APNs token"
            value={
              registration.pushToken
                ? copied
                  ? 'Copied'
                  : `${registration.pushToken.slice(0, 12)}… (tap to copy)`
                : 'None'
            }
          />
        </Pressable>
        {registration.error ? (
          <ThemedText type="small" style={styles.error}>
            {registration.error}
          </ThemedText>
        ) : null}
      </Section>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.section}>
      <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitle}>
        {title.toUpperCase()}
      </ThemedText>
      <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>{children}</View>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="small" numberOfLines={1} style={styles.rowValue}>
        {value}
      </ThemedText>
    </View>
  );
}

function StatusRow({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <View style={styles.row}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <View style={styles.status}>
        <View style={[styles.dot, { backgroundColor: ok ? '#1E8E3E' : '#D93025' }]} />
        <ThemedText type="small">{value}</ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: Spacing.three,
    gap: Spacing.four,
  },
  section: {
    gap: Spacing.two,
  },
  sectionTitle: {
    fontSize: 12,
    letterSpacing: 0.6,
  },
  card: {
    borderRadius: 12,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.three,
  },
  rowValue: {
    flexShrink: 1,
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  button: {
    alignItems: 'center',
    paddingVertical: Spacing.three,
    borderRadius: 12,
  },
  primary: {
    backgroundColor: '#D93025',
  },
  primaryText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.5,
  },
  error: {
    color: '#D93025',
  },
});
