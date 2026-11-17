import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getById } from '../data/store';
import { Account } from '../types';
import { Spinner } from '../components/Spinner';
import { AccountForm } from './AccountForm';

/** Edit an account on the same full page as New account, filled in with what is saved. */
export function AccountEdit() {
  const { id } = useParams();
  const [account, setAccount] = useState<Account | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'failed'>('loading');

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    getById<Account>('accounts', id ?? '', true).then(
      (found) => {
        if (cancelled) return;
        setAccount(found ?? null);
        setState(found ? 'ready' : 'missing');
      },
      () => { if (!cancelled) setState('failed'); },
    );
    return () => { cancelled = true; };
  }, [id]);

  if (state === 'loading') return <Spinner label="Loading account…" />;
  if (state === 'failed') {
    return (
      <div className="banner banner-error" role="alert" data-testid="account-load-error">
        This account couldn’t load. Check your connection and reload the page.
      </div>
    );
  }
  if (state === 'missing' || !account) {
    return (
      <div className="empty-cell">
        Account not found. <Link to="/accounts">Back to accounts</Link>
      </div>
    );
  }
  return <AccountForm key={account.id} existing={account} />;
}
