import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Which bank's data the code that is running right now may touch.
 *
 * Route files import one `store` (db.ts) and use it as before. That `store` forwards
 * to the store held here, which requireAuth sets from the signed-in user's bank for
 * the length of the request. Code that runs with no bank set gets an error, never
 * another bank's data.
 *
 * This file imports nothing from the app so db.ts and tenancy.ts can both use it.
 */
const current = new AsyncLocalStorage<{ bankId: string; store: unknown }>();
let fallback: { bankId: string; store: unknown } | undefined;

export function runWithBankStore<T>(bankId: string, store: unknown, fn: () => T): T {
  return current.run({ bankId, store }, fn);
}

export function currentBankStore(): unknown {
  const context = current.getStore() ?? fallback;
  if (!context) throw new Error('No bank is selected for this request.');
  return context.store;
}

export function currentBankId(): string {
  const context = current.getStore() ?? fallback;
  if (!context) throw new Error('No bank is selected for this request.');
  return context.bankId;
}

/** Tests only: lets set-up code outside a request use `store` for one bank. */
export function setFallbackBankStore(bankId: string, store: unknown): void {
  fallback = { bankId, store };
}
