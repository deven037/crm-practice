import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getById } from '../data/store';
import { Deal } from '../types';
import { Spinner } from '../components/Spinner';
import { DealForm } from './DealForm';

/** Edit a deal on the same full page as New deal, filled in with what is saved. */
export function DealEdit() {
  const { id } = useParams();
  const [deal, setDeal] = useState<Deal | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'failed'>('loading');

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    getById<Deal>('deals', id ?? '', true).then(
      (found) => {
        if (cancelled) return;
        setDeal(found ?? null);
        setState(found ? 'ready' : 'missing');
      },
      () => { if (!cancelled) setState('failed'); },
    );
    return () => { cancelled = true; };
  }, [id]);

  if (state === 'loading') return <Spinner label="Loading deal…" />;
  if (state === 'failed') {
    return (
      <div className="banner banner-error" role="alert" data-testid="deal-load-error">
        This deal couldn’t load. Check your connection and reload the page.
      </div>
    );
  }
  if (state === 'missing' || !deal) {
    return (
      <div className="empty-cell">
        Deal not found. <Link to="/deals">Back to deals</Link>
      </div>
    );
  }
  return <DealForm key={deal.id} existing={deal} />;
}
