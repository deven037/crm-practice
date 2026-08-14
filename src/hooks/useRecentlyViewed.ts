import { useCallback, useEffect, useState } from 'react';
import { getValue, setValue } from '../data/store';

export interface RecentRecord {
  module: string;
  id: string;
  label: string;
  link: string;
  meta?: Record<string, string>;
  viewedAt: string;
}

const KEY = 'recentlyViewed';
const MAX = 8;

let listeners: (() => void)[] = [];
function notify() {
  listeners.forEach((l) => l());
}

/** Automatic last-viewed-record tracking — distinct from any manual "favorite" concept. */
export function useRecentlyViewed() {
  const [items, setItems] = useState<RecentRecord[]>(() => getValue<RecentRecord[]>(KEY, []));

  useEffect(() => {
    const listener = () => setItems(getValue<RecentRecord[]>(KEY, []));
    listeners.push(listener);
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  }, []);

  const recordView = useCallback((record: Omit<RecentRecord, 'viewedAt'>) => {
    const current = getValue<RecentRecord[]>(KEY, []);
    const next = [{ ...record, viewedAt: new Date().toISOString() }, ...current.filter((r) => r.id !== record.id)].slice(0, MAX);
    setValue(KEY, next);
    notify();
  }, []);

  return { items, recordView };
}
