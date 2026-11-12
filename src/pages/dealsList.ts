import { Deal } from '../types';

export type DealSortKey = 'name' | 'account' | 'stage' | 'amount' | 'probability' | 'closeDate' | 'owner';
export interface DealSort {
  key: DealSortKey;
  dir: 'asc' | 'desc';
}

export interface DealListFilter {
  /** Matches the deal name or its account name. */
  query: string;
  /** '' = all stages, 'open' = every stage except Closed ones, otherwise one exact stage. */
  stage: string;
}

export function filterDeals(deals: Deal[], filter: DealListFilter, accountName: (id: string | null) => string): Deal[] {
  const q = filter.query.trim().toLowerCase();
  return deals.filter((d) => {
    if (filter.stage === 'open' && d.stage.startsWith('Closed')) return false;
    if (filter.stage && filter.stage !== 'open' && d.stage !== filter.stage) return false;
    if (!q) return true;
    return d.name.toLowerCase().includes(q) || accountName(d.accountId).toLowerCase().includes(q);
  });
}

/** Applies a move at once, saves it, and puts the original deal back if saving fails. Returns whether it saved. */
export async function moveDealOptimistic(
  original: Deal,
  updated: Deal,
  save: (deal: Deal) => Promise<unknown>,
  setDeals: (update: (prev: Deal[]) => Deal[]) => void,
): Promise<boolean> {
  const swap = (next: Deal) => setDeals((prev) => prev.map((d) => (d.id === next.id ? next : d)));
  swap(updated);
  try {
    await save(updated);
    return true;
  } catch {
    swap(original);
    return false;
  }
}

export function sortDeals(
  deals: Deal[],
  sort: DealSort,
  accountName: (id: string | null) => string,
  ownerName: (id: string) => string,
): Deal[] {
  const value = (d: Deal): string | number => {
    switch (sort.key) {
      case 'name':
        return d.name.toLowerCase();
      case 'account':
        return accountName(d.accountId).toLowerCase();
      case 'owner':
        return ownerName(d.ownerId).toLowerCase();
      case 'stage':
        return d.stage;
      case 'amount':
        return d.amount;
      case 'probability':
        return d.probability;
      case 'closeDate':
        return d.closeDate;
    }
  };
  const sign = sort.dir === 'asc' ? 1 : -1;
  return [...deals].sort((a, b) => {
    const va = value(a);
    const vb = value(b);
    return va < vb ? -sign : va > vb ? sign : 0;
  });
}
