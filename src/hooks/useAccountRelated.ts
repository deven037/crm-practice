import { useEffect, useState } from 'react';
import { getAll } from '../data/store';
import { Contact, Deal, Quote } from '../types';

export interface AccountRelated {
  contacts: Contact[];
  deals: Deal[];
  quotes: Quote[];
  loading: boolean;
}

/** Shared related-record fetch for an account — used by both AccountDetailPanel and the Accounts list's expandable rows. */
export function useAccountRelated(accountId: string | null): AccountRelated {
  const [state, setState] = useState<AccountRelated>({ contacts: [], deals: [], quotes: [], loading: true });

  useEffect(() => {
    if (!accountId) return;
    let cancelled = false;
    setState((s) => ({ ...s, loading: true }));
    (async () => {
      const [c, d, q] = await Promise.all([getAll<Contact>('contacts'), getAll<Deal>('deals'), getAll<Quote>('quotes')]);
      if (cancelled) return;
      setState({
        contacts: c.filter((x) => x.accountId === accountId),
        deals: d.filter((x) => x.accountId === accountId),
        quotes: q.filter((x) => x.accountId === accountId),
        loading: false,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [accountId]);

  return state;
}
