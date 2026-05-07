'use client';

import { useCallback, useEffect, useState } from 'react';

export interface SavedBusiness {
  placeId:     string;
  name:        string;
  rating:      number;
  reviewCount: number;
  score:       number;
  address:     string;
  category:    string;
  savedAt:     number;
}

const SAVED_KEY = 'rr_saved_businesses';

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

export function useSavedBusinesses() {
  const [saved, setSaved] = useState<SavedBusiness[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setSaved(safeRead<SavedBusiness[]>(SAVED_KEY, []));
    setHydrated(true);
  }, []);

  const isSaved = useCallback(
    (placeId: string) => saved.some((b) => b.placeId === placeId),
    [saved]
  );

  const toggleSave = useCallback((business: Omit<SavedBusiness, 'savedAt'>) => {
    setSaved((prev) => {
      const exists = prev.some((b) => b.placeId === business.placeId);
      const next = exists
        ? prev.filter((b) => b.placeId !== business.placeId)
        : [{ ...business, savedAt: Date.now() }, ...prev];
      safeWrite(SAVED_KEY, next);
      return next;
    });
  }, []);

  const removeSaved = useCallback((placeId: string) => {
    setSaved((prev) => {
      const next = prev.filter((b) => b.placeId !== placeId);
      safeWrite(SAVED_KEY, next);
      return next;
    });
  }, []);

  return { saved, isSaved, toggleSave, removeSaved, hydrated };
}
