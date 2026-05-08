'use client';

/**
 * useCompare — manage the "compare two businesses" selection state.
 *
 * Uses a module-level pub/sub store (useSyncExternalStore) so every
 * CompareButton on the page re-renders in sync without a Context Provider.
 * Persists selections to sessionStorage so they survive soft navigations
 * within the same tab, but clear when the tab closes.
 */

import { useSyncExternalStore, useCallback } from 'react';

export interface CompareItem {
  placeId: string;
  name: string;
  score: number;
  category?: string;
}

const MAX_COMPARE = 2;
const STORAGE_KEY = 'rr_compare';

// ─── Module-level store ───────────────────────────────────────────────────────

let listeners: Array<() => void> = [];

function readFromStorage(): CompareItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CompareItem[]) : [];
  } catch {
    return [];
  }
}

let _state: CompareItem[] = readFromStorage();

function notify() {
  listeners.forEach((l) => l());
}

function setState(next: CompareItem[]) {
  _state = next;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // storage may be unavailable in some browsers
  }
  notify();
}

function subscribe(listener: () => void) {
  listeners = [...listeners, listener];
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

function getSnapshot(): CompareItem[] {
  return _state;
}

function getServerSnapshot(): CompareItem[] {
  return [];
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useCompare() {
  const items = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const isComparing = useCallback(
    (placeId: string) => items.some((i) => i.placeId === placeId),
    [items]
  );

  const toggleCompare = useCallback(
    (item: CompareItem) => {
      const current = _state;
      if (current.some((i) => i.placeId === item.placeId)) {
        setState(current.filter((i) => i.placeId !== item.placeId));
      } else if (current.length < MAX_COMPARE) {
        setState([...current, item]);
      }
      // If already at max and this item isn't selected, do nothing
      // (UI should disable the button in that case)
    },
    []
  );

  const clearCompare = useCallback(() => setState([]), []);

  const isFull = items.length >= MAX_COMPARE;
  const compareUrl =
    items.length === MAX_COMPARE
      ? `/compare?a=${encodeURIComponent(items[0].placeId)}&b=${encodeURIComponent(items[1].placeId)}${items[0].category ? `&cat=${encodeURIComponent(items[0].category)}` : ''}`
      : null;

  return { items, isComparing, toggleCompare, clearCompare, isFull, compareUrl };
}
