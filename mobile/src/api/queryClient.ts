import { QueryClient } from '@tanstack/react-query';

/**
 * React Query replaces the web app's `getAllSync()` pre-warmed-cache idiom (see
 * src/data/store.ts on the web side) — there's no equivalent assumption here of a
 * synchronously-available cache. Every module hook fetches on demand and gets real
 * loading/error/empty/refetch states, which are also the states worth automating against.
 *
 * Query key convention: ['leads'] for a list, ['leads', id] for a single record.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 10_000,
    },
  },
});
