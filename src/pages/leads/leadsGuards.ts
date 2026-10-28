export const clearSelection = (): string[] => [];

// Returns true for the first caller and false for any call made before the flag is released.
export const beginOnce = (flag: { current: boolean }): boolean => {
  if (flag.current) return false;
  flag.current = true;
  return true;
};

// Up to `size` consecutive page numbers that always include the current page.
export const pageWindow = (currentPage: number, totalPages: number, size = 7): number[] => {
  const count = Math.min(size, totalPages);
  const start = Math.max(1, Math.min(currentPage - Math.floor(size / 2), totalPages - count + 1));
  return Array.from({ length: count }, (_, i) => start + i);
};

export type EmptyStateKind = 'no-leads' | 'no-matches';

// An empty collection is "no leads"; leads that exist but are all hidden by filters or search are "no matches".
export const emptyStateKind = (totalLeads: number): EmptyStateKind => (totalLeads === 0 ? 'no-leads' : 'no-matches');

export type AriaSortValue = 'ascending' | 'descending' | 'none';

export const getAriaSort = (
  columnKey: string,
  currentSortKey: string,
  sortDir: 'asc' | 'desc'
): AriaSortValue => {
  if (columnKey !== currentSortKey) return 'none';
  return sortDir === 'asc' ? 'ascending' : 'descending';
};

export const shouldOpenRowOnKeyDown = (key: string, isSelfTarget: boolean): boolean => {
  return isSelfTarget && key === 'Enter';
};
