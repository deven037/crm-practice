import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getAll, getAllSync, getById, removeMany, saveAll, upsert } from '../data/store';
import { Campaign, CAMPAIGN_CHANNELS, CAMPAIGN_STATUSES, Deal, Lead } from '../types';
import { Modal } from '../components/Modal';
import { Select } from '../components/Select';
import { DatePicker } from '../components/DatePicker';
import { CustomFieldsSection } from '../components/CustomFieldsSection';
import { Spinner } from '../components/Spinner';
import { useToast } from '../components/Toast';
import { useAuth } from '../auth/AuthContext';
import { formatCurrency, formatDate } from '../utils';

const STATUS_PILL: Record<Campaign['status'], string> = {
  Planned: 'status-new',
  Active: 'status-qualified',
  Completed: 'status-converted',
  Cancelled: 'status-unqualified',
};

export function CampaignDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Campaign | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmName, setConfirmName] = useState('');
  const { user } = useAuth();

  useEffect(() => {
    (async () => {
      const [c, l, d] = await Promise.all([
        getById<Campaign>('campaigns', id ?? ''),
        getAll<Lead>('leads'),
        getAll<Deal>('deals'),
      ]);
      if (!c) {
        setNotFound(true);
        return;
      }
      setCampaign(c);
      setLeads(l.filter((lead) => lead.campaignId === c.id));
      setDeals(d.filter((deal) => deal.campaignId === c.id));
    })();
  }, [id]);

  if (notFound) {
    return (
      <div className="empty-cell">
        Campaign not found. <Link to="/campaigns">Back to campaigns</Link>
      </div>
    );
  }
  if (!campaign) return <Spinner label="Loading campaign…" />;

  const save = async () => {
    if (!draft) return;
    if (!draft.name.trim()) {
      toast.push('error', 'Campaign name is required.');
      return;
    }
    await upsert('campaigns', draft);
    setCampaign(draft);
    setEditing(false);
    toast.push('success', 'Campaign updated.');
  };

  const wonRevenue = deals.filter((d) => d.stage === 'Closed Won').reduce((sum, d) => sum + d.amount, 0);
  const roi = campaign.budget > 0 ? (wonRevenue / campaign.budget) * 100 : null;

  const doDelete = async () => {
    if (leads.length > 0) {
      const allLeads = getAllSync<Lead>('leads').map((l) =>
        l.campaignId === campaign.id ? { ...l, campaignId: null } : l
      );
      await saveAll('leads', allLeads);
    }
    if (deals.length > 0) {
      const allDeals = getAllSync<Deal>('deals').map((d) =>
        d.campaignId === campaign.id ? { ...d, campaignId: null } : d
      );
      await saveAll('deals', allDeals);
    }
    await removeMany('campaigns', [campaign.id]);
    toast.push('success', `Campaign "${campaign.name}" deleted.`);
    navigate('/campaigns');
  };

  const hasDependents = leads.length > 0 || deals.length > 0;

  return (
    <div data-testid="campaign-detail-page">
      <nav className="breadcrumbs">
        <Link to="/campaigns">Campaigns</Link> <span>/</span> <span>{campaign.name}</span>
      </nav>

      <div className="page-header">
        <h1>{campaign.name}</h1>
        <div className="page-actions">
          <span className={`pill ${STATUS_PILL[campaign.status]}`} data-testid="campaign-status">
            {campaign.status}
          </span>
          {!editing ? (
            <>
              <button
                className="btn"
                data-testid="edit-campaign-btn"
                onClick={() => {
                  setDraft({ ...campaign });
                  setEditing(true);
                }}
              >
                ✏️ Edit
              </button>
              <button
                className="btn btn-danger"
                data-testid="delete-campaign-btn"
                onClick={() => {
                  setConfirmName('');
                  setDeleting(true);
                }}
              >
                🗑 Delete
              </button>
            </>
          ) : (
            <>
              <button className="btn" onClick={() => setEditing(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" data-testid="save-campaign-btn" onClick={save}>
                Save
              </button>
            </>
          )}
        </div>
      </div>

      <div className="card">
        {!editing ? (
          <dl className="detail-list">
            <dt>Channel</dt>
            <dd>{campaign.channel}</dd>
            <dt>Budget</dt>
            <dd>{formatCurrency(campaign.budget)}</dd>
            <dt>Start date</dt>
            <dd>{formatDate(campaign.startDate)}</dd>
            <dt>End date</dt>
            <dd>{formatDate(campaign.endDate)}</dd>
            <dt>Created</dt>
            <dd>{formatDate(campaign.createdAt)}</dd>
            <CustomFieldsSection module="campaigns" target="detail" mode="view" values={campaign.customFields ?? {}} />
          </dl>
        ) : (
          draft && (
            <div className="form-grid">
              <div className="field">
                <span className="field-label">Campaign name *</span>
                <input className="input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              </div>
              <div className="field">
                <span className="field-label">Channel</span>
                <Select
                  value={draft.channel}
                  options={CAMPAIGN_CHANNELS.map((c) => ({ value: c, label: c }))}
                  onChange={(v) => setDraft({ ...draft, channel: v })}
                />
              </div>
              <div className="field">
                <span className="field-label">Budget ($)</span>
                <input
                  className="input"
                  type="number"
                  value={draft.budget}
                  onChange={(e) => setDraft({ ...draft, budget: Number(e.target.value) })}
                />
              </div>
              <div className="field">
                <span className="field-label">Status</span>
                <Select
                  value={draft.status}
                  options={CAMPAIGN_STATUSES.map((s) => ({ value: s, label: s }))}
                  onChange={(v) => setDraft({ ...draft, status: v as Campaign['status'] })}
                />
              </div>
              <div className="field">
                <span className="field-label">Start date</span>
                <DatePicker value={draft.startDate} onChange={(iso) => setDraft({ ...draft, startDate: iso })} />
              </div>
              <div className="field">
                <span className="field-label">End date</span>
                <DatePicker value={draft.endDate} onChange={(iso) => setDraft({ ...draft, endDate: iso })} />
              </div>
              <CustomFieldsSection
                module="campaigns"
                target="detail"
                mode="edit"
                values={draft.customFields ?? {}}
                onChange={(k, v) => setDraft({ ...draft, customFields: { ...draft.customFields, [k]: v } })}
              />
            </div>
          )
        )}
      </div>

      <div className="card">
        <h3>Return on investment</h3>
        <dl className="detail-list">
          <dt>Won revenue (from converted leads)</dt>
          <dd>{formatCurrency(wonRevenue)}</dd>
          <dt>ROI</dt>
          <dd data-testid="campaign-roi">{roi === null ? '— (no budget set)' : `${roi.toFixed(1)}%`}</dd>
        </dl>
      </div>

      <div className="card">
        <div className="page-header">
          <h3>Leads generated ({leads.length})</h3>
          <button
            className="btn btn-small"
            data-testid="new-lead-for-campaign-btn"
            onClick={() => navigate(`/leads/new?campaignId=${campaign.id}`)}
          >
            + New lead for this campaign
          </button>
        </div>
        {leads.length === 0 ? (
          <p className="muted">No leads yet for this campaign.</p>
        ) : (
          <ul className="related-list">
            {leads.map((lead) => (
              <li key={lead.id}>
                <Link to={`/leads/${lead.id}`}>{lead.name}</Link>{' '}
                <span className="muted">
                  — {lead.company} · <span className={`pill status-${lead.status.toLowerCase()}`}>{lead.status}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {deals.length > 0 && (
        <div className="card">
          <h3>Deals attributed ({deals.length})</h3>
          <ul className="related-list">
            {deals.map((deal) => (
              <li key={deal.id}>
                <Link to={`/deals/${deal.id}`}>{deal.name}</Link>{' '}
                <span className="muted">
                  — {formatCurrency(deal.amount)} · {deal.stage}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {deleting && (
        <Modal
          title={`Delete campaign — ${campaign.name}`}
          onClose={() => setDeleting(false)}
          footer={
            <>
              <button className="btn" onClick={() => setDeleting(false)}>
                Cancel
              </button>
              <button
                className="btn btn-danger"
                data-testid="confirm-delete-btn"
                disabled={hasDependents && confirmName !== campaign.name}
                onClick={doDelete}
              >
                Delete campaign
              </button>
            </>
          }
        >
          {!hasDependents ? (
            <p>Delete “{campaign.name}”? This cannot be undone.</p>
          ) : (
            <>
              <div className="banner banner-error" role="alert">
                {leads.length} lead(s) and {deals.length} deal(s) reference this campaign. Deleting it will{' '}
                <strong>unlink</strong> the campaign from those records — they are kept.
              </div>
              <div className="field">
                <span className="field-label">Type the campaign name to confirm</span>
                <input
                  className="input"
                  data-testid="delete-confirm-input"
                  placeholder={campaign.name}
                  value={confirmName}
                  onChange={(e) => setConfirmName(e.target.value)}
                />
              </div>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}
