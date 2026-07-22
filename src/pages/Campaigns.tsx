import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAll } from '../data/store';
import { Campaign } from '../types';
import { SkeletonRows } from '../components/Spinner';
import { formatCurrency, formatDate } from '../utils';

const STATUS_PILL: Record<Campaign['status'], string> = {
  Planned: 'status-new',
  Active: 'status-qualified',
  Completed: 'status-converted',
  Cancelled: 'status-unqualified',
};

export function Campaigns() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    (async () => {
      setCampaigns(await getAll<Campaign>('campaigns'));
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 350);
    return () => clearTimeout(t);
  }, [query]);

  // Recently created first
  const sorted = useMemo(
    () => [...campaigns].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [campaigns]
  );

  const filtered = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter(
      (c) => c.name.toLowerCase().includes(q) || c.channel.toLowerCase().includes(q) || c.status.toLowerCase().includes(q)
    );
  }, [sorted, debouncedQuery]);

  return (
    <div data-testid="campaigns-page">
      <div className="page-header">
        <h1>Campaigns</h1>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={() => navigate('/campaigns/new')}>
            + New Campaign
          </button>
        </div>
      </div>

      <div className="toolbar">
        <input
          type="search"
          className="input search-input"
          placeholder="Search name, channel, status…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <span className="muted">Sorted by most recently created</span>
      </div>

      {loading ? (
        <SkeletonRows rows={8} />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Channel</th>
                <th className="num">Budget</th>
                <th>Status</th>
                <th>Start</th>
                <th>End</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((campaign) => (
                <tr key={campaign.id} className="row-clickable" onClick={() => navigate(`/campaigns/${campaign.id}`)}>
                  <td>{campaign.name}</td>
                  <td>{campaign.channel}</td>
                  <td className="num">{formatCurrency(campaign.budget)}</td>
                  <td>
                    <span className={`pill ${STATUS_PILL[campaign.status]}`}>{campaign.status}</span>
                  </td>
                  <td>{formatDate(campaign.startDate)}</td>
                  <td>{formatDate(campaign.endDate)}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty-cell">
                    No campaigns match “{query}”.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
