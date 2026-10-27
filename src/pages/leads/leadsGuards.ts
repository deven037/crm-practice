export const clearSelection = (): string[] => [];

// Returns true for the first caller and false for any call made before the flag is released.
export const beginOnce = (flag: { current: boolean }): boolean => {
  if (flag.current) return false;
  flag.current = true;
  return true;
};
