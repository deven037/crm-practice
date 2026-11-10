import { describe, expect, it } from 'vitest';
import { loadAccountsWithOwners } from './Accounts';

const accountRows = [{ id: 'a1', name: 'qa204viewer Alpha' }];

describe('loadAccountsWithOwners', () => {
  it('returns the accounts with no owners when the users request is forbidden (Viewer)', async () => {
    const load = (async (module: string) => {
      if (module === 'users') throw new Error('You do not have permission to perform this action.');
      return accountRows;
    }) as Parameters<typeof loadAccountsWithOwners>[0];

    const result = await loadAccountsWithOwners(load);

    expect(result.accounts).toEqual(accountRows);
    expect(result.users).toEqual([]);
  });

  it('returns both lists when users load', async () => {
    const load = (async (module: string) => (module === 'users' ? [{ id: 'u1' }] : accountRows)) as Parameters<
      typeof loadAccountsWithOwners
    >[0];

    const result = await loadAccountsWithOwners(load);

    expect(result.users).toHaveLength(1);
  });
});
