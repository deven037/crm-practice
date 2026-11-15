import { describe, expect, it } from 'vitest';
import { loadAccountDetail } from './AccountDetail';

const account = { id: 'account-2', name: 'BlueOak Labs' };
const contact = { id: 'c1', accountId: 'account-2' };
const otherContact = { id: 'c2', accountId: 'account-9' };

const fetchOne = (async () => account) as unknown as Parameters<typeof loadAccountDetail>[0];

describe('loadAccountDetail', () => {
  it('still returns the account when the contacts request fails with 500', async () => {
    const fetchAll = (async (module: string) => {
      if (module === 'contacts') throw new Error('Request failed (500)');
      return [];
    }) as Parameters<typeof loadAccountDetail>[1];

    const result = await loadAccountDetail(fetchOne, fetchAll, 'account-2');

    expect(result.account).toEqual(account);
    expect(result.contacts).toBeNull();
    expect(result.deals).toEqual([]);
    expect(result.quotes).toEqual([]);
  });

  it('returns only the contacts linked to the account when everything loads', async () => {
    const fetchAll = (async (module: string) => (module === 'contacts' ? [contact, otherContact] : [])) as Parameters<
      typeof loadAccountDetail
    >[1];

    const result = await loadAccountDetail(fetchOne, fetchAll, 'account-2');

    expect(result.contacts).toEqual([contact]);
  });
});
