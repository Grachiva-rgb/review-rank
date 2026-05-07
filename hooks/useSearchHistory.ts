'use client';

import { useCallback, useEffect, useState } from 'react';

export interface RecentSearch {
  category: string;
  location: string;
  timestamp: number;
}

const LOCATION_KEY   = 'rr_last_location';
const SEARCHES_KEY   = 'rr_recent_searches';
const MAX_RECENT     = 5;

function safeRead<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function safeWrite(key: string, value: unknown) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* quota exceeded */ }
}

/** Returns the last location the user searched with. */
export function useLastLocation(): string {
  const [loc, setLoc] = useState('');
  useEffect(() => {
    setLoc(safeRead<string>(LOCATION_KEY, ''));
  }, []);
  return loc;
}

/** Full search-history hook: reads recent searches + exposes save/clear helpers. */
export function useSearchHistory() {
  const [recents, setRecents] = useState<RecentSearch[]>([]);

  useEffect(() => {
    setRecents(safeRead<RecentSearch[]>(SEARCHES_KEY, []));
  }, []);

  const saveSearch = useCallback((category: string, location: string) => {
    if (!category || !location) return;
    const entry: RecentSearch = { category, location, timestamp: Date.now() };

    // Persist last location separately for fast reads
    safeWrite(LOCATION_KEY, location);

    // Deduplicate by category+location (case-insensitive), keep most recent at top
    const deduped = safeRead<RecentSearch[]>(SEARCHES_KEY, [])
      .filter(
        (s) =>
          !(s.category.toLowerCase() === category.toLowerCase() &&
            s.location.toLowerCase() === location.toLowerCase())
      );
    const updated = [entry, ...deduped].slice(0, MAX_RECENT);
    safeWrite(SEARCHES_KEY, updated);
    setRecents(updated);
  }, []);

  const clearHistory = useCallback(() => {
    safeWrite(SEARCHES_KEY, []);
    setRecents([]);
  }, []);

  return { recents, saveSearch, clearHistory };
}
