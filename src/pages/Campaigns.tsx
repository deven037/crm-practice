import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutGrid, Table2 } from 'lucide-react';
import { getAll } from '../data/store';
import { Campaign, CAMPAIGN_STATUSES } from '../types';
import { SkeletonRows } from '../components/Spinner';
import { LayoutPickerPanel } from '../components/LayoutPickerPanel';
import { ToolBoxPanel } from '../components/ToolBoxPanel';
import { classNames, formatCurrency, formatDate } from '../utils';

const STATUS_PILL: Record<Campaign['status'], string> = {
  Planned: 'status-new',
  Active: 'status-qualified',
  Completed: 'status-converted',
  Cancelled: 'status-unqualified',
};

/** % of the campaign's date range elapsed — no "spent" field exists on Campaign, so this is a timeline-progress proxy. */
function timelineProgress(campaign: Campaign): number {
  const start = new Date(campaign.startDate).getTime();
  const end = new Date(campaign.endDate).getTime();
  const now = Date.now();
  if (end <= start) return 0;
  return Math.max(0, Math.min(100, ((now - start) / (end - start)) * 100));
}

export function Campaigns() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [view, setView] = useState<'board' | 'table'>('board');
  const [layoutPickerOpen, setLayoutPickerOpen] = useState(false);

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
          <div className="view-toggle" role="group" aria-label="View mode">
            <button
              className={classNames('btn', view === 'board' && 'btn-active')}
              aria-label="Board view"
              data-testid="view-board"
              onClick={() => setView('board')}
            >
              <LayoutGrid size={14} /> Board
            </button>
            <button
              className={classNames('btn', view === 'table' && 'btn-active')}
              aria-label="Table view"
              data-testid="view-table"
              onClick={() => setView('table')}
            >
              <Table2 size={14} /> Table
            </button>
          </div>
          <button className="btn btn-create" onClick={() => setLayoutPickerOpen(true)}>
            + New Campaign
          </button>
        </div>
      </div>

      <ToolBoxPanel
        module="campaigns"
        links={[
          { label: 'Status Codes', to: '/setup/status-codes' },
          { label: 'Custom Fields', to: '/admin/objects/campaigns' },
          { label: 'Customise Page Layout', to: '/setup/layouts/campaigns' },
        ]}
      />

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
      ) : view === 'board' ? (
        <div className="status-board" data-testid="campaign-board">
          {CAMPAIGN_STATUSES.map((status) => {
            const colCampaigns = filtered.filter((c) => c.status === status);
            return (
              <div key={status} className="status-board-col">
                <div className="status-board-head">
                  <span className="kanban-title">{status}</span>
                  <span className="kanban-meta">{colCampaigns.length}</span>
                </div>
                <div className="status-board-cards">
                  {colCampaigns.map((campaign) => (
                    <div key={campaign.id} className="status-board-card" onClick={() => navigate(`/campaigns/${campaign.id}`)}>
                      <div className="status-board-card-title">{campaign.name}</div>
                      <div className="muted">{campaign.channel} · {formatCurrency(campaign.budget)}</div>
                      <div className="status-board-progress-track">
                        <div className="status-board-progress-fill" style={{ width: `${timelineProgress(campaign)}%` }} />
                      </div>
                    </div>
                  ))}
                  {colCampaigns.length === 0 && <div className="kanban-empty">No campaigns</div>}
                </div>
              </div>
            );
          })}
        </div>
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

      {layoutPickerOpen && (
        <LayoutPickerPanel module="campaigns" basePath="/campaigns" onClose={() => setLayoutPickerOpen(false)} />
      )}
    </div>
  );
}
