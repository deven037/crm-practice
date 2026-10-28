export const clearSelection = (): string[] => [];

// Export CSV is offered to admin and rep; the read-only viewer role cannot export.
export const canExportLeads = (role: string | undefined): boolean => role === 'admin' || role === 'rep';

// Returns true for the first caller and false for any call made before the flag is released.
export const beginOnce = (flag: { current: boolean }): boolean => {
  if (flag.current) return false;
  flag.current = true;
  return true;
};

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
