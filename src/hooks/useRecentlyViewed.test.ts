import { describe, expect, it, vi } from 'vitest';

const store = vi.hoisted(() => ({ value: [] as { id: string }[] }));
vi.mock('../data/store', () => ({
  getValue: () => store.value,
  setValue: (_key: string, next: { id: string }[]) => { store.value = next; },
}));

import { removeRecentViews } from './useRecentlyViewed';

describe('removeRecentViews', () => {
  it('removes only the deleted records from Recently Accessed', () => {
    store.value = [{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }];
    removeRecentViews(['c1', 'c3']);
    expect(store.value).toEqual([{ id: 'c2' }]);
  });
});
