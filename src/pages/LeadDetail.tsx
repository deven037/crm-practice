import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getAllSync, getById, logAudit, removeMany, upsert } from '../data/store';
import { Campaign, Lead, LeadStatus, LEAD_SOURCES, LEAD_STATUSES, Product, User } from '../types';
import { Modal } from '../components/Modal';
import { SearchableSelect, Select } from '../components/Select';
import { CustomFieldsSection, validateCustomFields } from '../components/CustomFieldsSection';
import { Spinner } from '../components/Spinner';
import { useToast } from '../components/Toast';
import { useAuth } from '../auth/AuthContext';
import { formatCurrency, formatDate } from '../utils';

export function LeadDetail() {
  const { id } = useParams();
  const toast = useToast();
  const [lead, setLead] = useState<Lead | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Lead | null>(null);
  const [deleting, setDeleting] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    (async () => {
      const l = await getById<Lead>('leads', id ?? '');
      if (!l) setNotFound(true);
      else setLead(l);
    })();
  }, [id]);

  if (notFound) {
    return (
      <div className="empty-cell">
        Lead not found. <Link to="/leads">Back to leads</Link>
      </div>
    );
  }
  if (!lead) return <Spinner label="Loading lead…" />;

  const users = getAllSync<User>('users');
  const products = getAllSync<Product>('products');
  const campaigns = getAllSync<Campaign>('campaigns');
  const ownerName = users.find((u) => u.id === lead.ownerId)?.name ?? '—';
  const product = products.find((p) => p.id === lead.productId);
  const campaign = campaigns.find((c) => c.id === lead.campaignId);

  const save = async () => {
    if (!draft) return;
    if (!draft.name.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(draft.email.trim())) {
      toast.push('error', 'Name and a valid email are required.');
      return;
    }
    const cErrs = validateCustomFields('leads', 'detail', draft.customFields ?? {});
    if (Object.keys(cErrs).length > 0) {
      toast.push('error', Object.values(cErrs)[0]);
      return;
    }
    await upsert('leads', draft);
    logAudit(user?.name ?? 'Unknown', 'lead.update', `Updated lead ${draft.name}`);
    setLead(draft);
    setEditing(false);
    toast.push('success', 'Lead updated.');
  };

  return (
    <div data-testid="lead-detail-page">
      <nav className="breadcrumbs">
        <Link to="/leads">Leads</Link> <span>/</span> <span>{lead.name}</span>
      </nav>

      <div className="page-header">
        <h1>{lead.name}</h1>
        <div className="page-actions">
          <span className={`pill status-${lead.status.toLowerCase()}`} data-testid="lead-detail-status">
            {lead.status}
          </span>
          {!editing ? (
            <>
              <button
                className="btn"
                data-testid="edit-lead-btn"
                onClick={() => {
                  setDraft({ ...lead });
                  setEditing(true);
                }}
              >
                ✏️ Edit
              </button>
              <button className="btn btn-danger" data-testid="delete-lead-btn" onClick={() => setDeleting(true)}>
                🗑 Delete
              </button>
            </>
          ) : (
            <>
              <button className="btn" onClick={() => setEditing(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" data-testid="save-lead-btn" onClick={save}>
                Save
              </button>
            </>
          )}
        </div>
      </div>

      <div className="card">
        {!editing ? (
          <dl className="detail-list">
            <dt>Company</dt>
            <dd>{lead.company || '—'}</dd>
            <dt>Email</dt>
            <dd>{lead.email}</dd>
            <dt>Phone</dt>
            <dd>{lead.phone || '—'}</dd>
            <dt>Source</dt>
            <dd>{lead.source}</dd>
            <dt>Owner</dt>
            <dd>{ownerName}</dd>
            <dt>Estimated value</dt>
            <dd>{formatCurrency(lead.value)}</dd>
            <dt>Interested product</dt>
            <dd>{product ? <Link to={`/products/${product.id}`}>{product.name}</Link> : '—'}</dd>
            <dt>Campaign</dt>
            <dd>{campaign ? <Link to={`/campaigns/${campaign.id}`}>{campaign.name}</Link> : '—'}</dd>
            <dt>Created</dt>
            <dd>{formatDate(lead.createdAt)}</dd>
            <CustomFieldsSection module="leads" target="detail" mode="view" values={lead.customFields ?? {}} />
          </dl>
        ) : (
          draft && (
            <div className="form-grid">
              <div className="field">
                <span className="field-label">Full name *</span>
                <input className="input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              </div>
              <div className="field">
                <span className="field-label">Company</span>
                <input className="input" value={draft.company} onChange={(e) => setDraft({ ...draft, company: e.target.value })} />
              </div>
              <div className="field">
                <span className="field-label">Email *</span>
                <input className="input" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
              </div>
              <div className="field">
                <span className="field-label">Phone</span>
                <input className="input" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
              </div>
              <div className="field">
                <span className="field-label">Status</span>
                <Select
                  value={draft.status}
                  options={LEAD_STATUSES.map((s) => ({ value: s, label: s }))}
                  onChange={(v) => setDraft({ ...draft, status: v as LeadStatus })}
                />
              </div>
              <div className="field">
                <span className="field-label">Source</span>
                <Select
                  value={draft.source}
                  options={LEAD_SOURCES.map((s) => ({ value: s, label: s }))}
                  onChange={(v) => setDraft({ ...draft, source: v })}
                />
              </div>
              <div className="field">
                <span className="field-label">Interested product</span>
                <SearchableSelect
                  value={draft.productId ?? ''}
                  options={[{ value: '', label: 'No product' }, ...products.map((p) => ({ value: p.id, label: p.name }))]}
                  onChange={(v) => setDraft({ ...draft, productId: v || null })}
                  placeholder="Search products…"
                />
              </div>
              <div className="field">
                <span className="field-label">Campaign</span>
                <SearchableSelect
                  value={draft.campaignId ?? ''}
                  options={[{ value: '', label: 'No campaign' }, ...campaigns.map((c) => ({ value: c.id, label: c.name }))]}
                  onChange={(v) => setDraft({ ...draft, campaignId: v || null })}
                  placeholder="Search campaigns…"
                />
              </div>
              <div className="field">
                <span className="field-label">Owner</span>
                <Select
                  value={draft.ownerId}
                  options={users.map((u) => ({ value: u.id, label: u.name }))}
                  onChange={(v) => setDraft({ ...draft, ownerId: v })}
                />
              </div>
              <div className="field">
                <span className="field-label">Estimated value ($)</span>
                <input
                  className="input"
                  type="number"
                  value={draft.value}
                  onChange={(e) => setDraft({ ...draft, value: Number(e.target.value) })}
                />
              </div>
              <CustomFieldsSection
                module="leads"
                target="detail"
                mode="edit"
                values={draft.customFields ?? {}}
                onChange={(k, v) => setDraft({ ...draft, customFields: { ...draft.customFields, [k]: v } })}
              />
            </div>
          )
        )}
      </div>

      {deleting && (
        <Modal
          title={`Delete lead — ${lead.name}`}
          onClose={() => setDeleting(false)}
          footer={
            <>
              <button className="btn" onClick={() => setDeleting(false)}>
                Cancel
              </button>
              <button
                className="btn btn-danger"
                data-testid="confirm-delete-btn"
                onClick={async () => {
                  await removeMany('leads', [lead.id]);
                  logAudit(user?.name ?? 'Unknown', 'lead.delete', `Deleted lead ${lead.name}`);
                  toast.push('success', `Lead "${lead.name}" deleted.`);
                  navigate('/leads');
                }}
              >
                Delete lead
              </button>
            </>
          }
        >
          <p>Delete “{lead.name}”? This cannot be undone.</p>
          {lead.status === 'Converted' && (
            <div className="banner banner-info" data-testid="converted-warning">
              This lead was already <strong>converted</strong> — the contact, account, and deal created from it will{' '}
              <strong>not</strong> be deleted.
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
