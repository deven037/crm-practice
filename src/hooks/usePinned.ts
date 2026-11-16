import { useCallback, useEffect, useState } from 'react';
import { getValue, setValue } from '../data/store';

export interface PinnedRecord {
  module: string;
  id: string;
  label: string;
  link: string;
}

const KEY = 'pinned';
export const MAX_PINNED = 6;

let listeners: (() => void)[] = [];
const notify = () => listeners.forEach((l) => l());

/** Adds the record, or removes it when it is already pinned. The newest pin comes first; the oldest drops off past the limit. */
export function togglePinned(current: PinnedRecord[], record: PinnedRecord, max = MAX_PINNED): PinnedRecord[] {
  if (current.some((p) => p.link === record.link)) return current.filter((p) => p.link !== record.link);
  return [record, ...current].slice(0, max);
}

/** Records a person chose to keep in the side menu. Kept on the device, like Recently viewed. */
export function usePinned() {
  const [items, setItems] = useState<PinnedRecord[]>(() => getValue<PinnedRecord[]>(KEY, []));

  useEffect(() => {
    const listener = () => setItems(getValue<PinnedRecord[]>(KEY, []));
    listeners.push(listener);
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  }, []);

  const toggle = useCallback((record: PinnedRecord) => {
    setValue(KEY, togglePinned(getValue<PinnedRecord[]>(KEY, []), record));
    notify();
  }, []);

  return { items, toggle };
}
