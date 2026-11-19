import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getById } from '../data/store';
import { Campaign } from '../types';
import { Spinner } from '../components/Spinner';
import { CampaignForm } from './CampaignForm';

/** Edit a campaign on the same full page as New campaign, filled in with what is saved. */
export function CampaignEdit() {
  const { id } = useParams();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'failed'>('loading');

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    getById<Campaign>('campaigns', id ?? '', true).then(
      (found) => {
        if (cancelled) return;
        setCampaign(found ?? null);
        setState(found ? 'ready' : 'missing');
      },
      (error) => { if (!cancelled) setState((error as { status?: number }).status === 404 ? 'missing' : 'failed'); },
    );
    return () => { cancelled = true; };
  }, [id]);

  if (state === 'loading') return <Spinner label="Loading campaign…" />;
  if (state === 'failed') return <div className="banner banner-error" role="alert">This campaign couldn’t load. Check your connection and reload the page.</div>;
  if (state === 'missing' || !campaign) return <div className="empty-cell">Campaign not found. <Link to="/campaigns">Back to campaigns</Link></div>;
  return <CampaignForm key={campaign.id} existing={campaign} />;
}
