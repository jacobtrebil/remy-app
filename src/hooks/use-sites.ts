import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

import { fetchSites } from '@/lib/remy-api';
import type { Site } from '@/lib/types';

const SELECTED_KEY = 'remy.selected_site_id';

/**
 * The homes this caregiver can see, plus which one the feed is showing.
 *
 * The selection is persisted so someone who looks after two homes does not have
 * to re-pick on every launch; it falls back to the first site when the stored id
 * no longer appears in their grants (access revoked, home removed).
 */
export function useSites() {
  const [sites, setSites] = useState<Site[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, stored] = await Promise.all([
        fetchSites(),
        AsyncStorage.getItem(SELECTED_KEY),
      ]);
      setSites(list);
      setError(null);
      setSelectedId(list.some((s) => s.id === stored) ? stored : (list[0]?.id ?? null));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSites(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const select = useCallback(async (siteId: string) => {
    setSelectedId(siteId);
    await AsyncStorage.setItem(SELECTED_KEY, siteId);
  }, []);

  return {
    sites,
    site: sites?.find((s) => s.id === selectedId) ?? null,
    loading,
    error,
    select,
    refresh: load,
  };
}
