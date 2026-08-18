import { useCallback, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useSession } from '@/hooks/use-session';
import { useSites } from '@/hooks/use-sites';
import { useTheme } from '@/hooks/use-theme';
import { APP_VERSION, CONTROL_PLANE_URL, IS_CONFIGURED } from '@/lib/config';
import { supabase } from '@/lib/supabase';

export default function Settings() {
  const theme = useTheme();
  const { user } = useSession();
  const { sites, site, select, loading, error } = useSites();
  const [signingOut, setSigningOut] = useState(false);

  const onSignOut = useCallback(async () => {
    setSigningOut(true);
    // The auth listener in useSession redirects to /sign-in.
    await supabase.auth.signOut();
  }, []);

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
      <Section title="Account">
        <Row label="Signed in as" value={user?.email ?? '—'} />
      </Section>

      <Section title="Homes">
        {loading ? (
          <ActivityIndicator />
        ) : error ? (
          <ThemedText type="small" style={styles.error}>
            {error}
          </ThemedText>
        ) : sites && sites.length > 0 ? (
          sites.map((s) => {
            const selected = s.id === site?.id;
            return (
              <Pressable
                key={s.id}
                onPress={() => select(s.id)}
                style={[
                  styles.site,
                  { backgroundColor: selected ? theme.backgroundSelected : 'transparent' },
                ]}>
                <View style={styles.siteText}>
                  <ThemedText type="small">{s.name}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {s.role} · {s.access_level.replace(/_/g, ' ')}
                  </ThemedText>
                </View>
                {selected ? <ThemedText type="smallBold">Selected</ThemedText> : null}
              </Pressable>
            );
          })
        ) : (
          <ThemedText type="small" themeColor="textSecondary">
            No homes yet. Ask a home&apos;s owner to invite you.
          </ThemedText>
        )}
      </Section>

      <Section title="Notifications">
        <ThemedText type="small" themeColor="textSecondary">
          Push alerts are not enabled yet. For now, open the app to check on the homes you care
          for — pull down on the list to refresh.
        </ThemedText>
      </Section>

      <Section title="Diagnostics">
        <Row label="Control plane" value={IS_CONFIGURED ? CONTROL_PLANE_URL : 'Not configured'} />
        <Row label="Site endpoint" value={site?.endpoint ?? '—'} />
        <Row label="App version" value={APP_VERSION} />
      </Section>

      <Pressable
        onPress={onSignOut}
        disabled={signingOut}
        style={[
          styles.signOut,
          { backgroundColor: theme.backgroundElement },
          signingOut && styles.disabled,
        ]}>
        <ThemedText type="default" style={styles.signOutText}>
          {signingOut ? 'Signing out…' : 'Sign out'}
        </ThemedText>
      </Pressable>
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

const styles = StyleSheet.create({
  content: { padding: Spacing.three, gap: Spacing.four },
  section: { gap: Spacing.two },
  sectionTitle: { fontSize: 12, letterSpacing: 0.6 },
  card: { borderRadius: 12, padding: Spacing.three, gap: Spacing.two },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.three,
  },
  rowValue: { flexShrink: 1, textAlign: 'right' },
  site: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
    borderRadius: 8,
  },
  siteText: { flex: 1, gap: Spacing.half },
  signOut: { alignItems: 'center', paddingVertical: Spacing.three, borderRadius: 12 },
  signOutText: { color: '#D93025', fontWeight: '600' },
  disabled: { opacity: 0.5 },
  error: { color: '#D93025' },
});
