import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Pencil, Trash2 } from 'lucide-react';
import { getAllSync, getById, removeMany, upsert } from '../data/store';
import { Campaign, Lead, LeadStatus, LEAD_SOURCES, LEAD_STATUSES, Product, User } from '../types';
import { Modal } from '../components/Modal';
import { SearchableSelect, Select } from '../components/Select';
import { CustomFieldsSection, validateCustomFields } from '../components/CustomFieldsSection';
import { RecordShell } from '../components/RecordShell';
import { Spinner } from '../components/Spinner';
import { useToast } from '../components/Toast';
import { useAuth } from '../auth/AuthContext';
import { useRecentlyViewed } from '../hooks/useRecentlyViewed';
import { formatCurrency, formatDate } from '../utils';
import { applyAssignmentRule, getStatusOptions } from '../utils/rules';
import { beginOnce, canChangeLeads, LeadEditErrors, validateLeadEdit } from './leads/leadsGuards';

export function LeadDetail() {
  const { id } = useParams();
  const toast = useToast();
  const [lead, setLead] = useState<Lead | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Lead | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [errors, setErrors] = useState<LeadEditErrors>({});
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { recordView } = useRecentlyViewed();
  const canChange = canChangeLeads(user?.role);

  useEffect(() => {
    (async () => {
      const l = await getById<Lead>('leads', id ?? '');
      if (!l) setNotFound(true);
      else setLead(l);
    })();
  }, [id]);

  useEffect(() => {
    if (lead) recordView({ module: 'leads', id: lead.id, label: lead.name, link: `/leads/${lead.id}`, meta: { Company: lead.company, Status: lead.status } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead?.id]);

  if (notFound) {
    return (
      <div className="empty-cell" role="status">
        <h2>Lead not found</h2>
        <p>It may have been deleted or the link is wrong.</p>
        <Link className="btn btn-primary" to="/leads">
          Back to Leads
        </Link>
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

  const closeEditor = () => {
    setEditing(false);
    setErrors({});
    setSaveError('');
  };

  const save = async () => {
    if (!draft) return;
    const fieldErrors = validateLeadEdit(draft.name, draft.email);
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) {
      setSaveError('Name and a valid email are required.');
      return;
    }
    const cErrs = validateCustomFields('leads', 'detail', draft.customFields ?? {});
    if (Object.keys(cErrs).length > 0) {
      setSaveError(Object.values(cErrs)[0]);
      return;
    }
    if (!beginOnce(savingRef)) return;
    setSaving(true);
    setSaveError('');
    try {
      // Setup → Assignment Rules: re-check on every save, not just at creation, so a rule whose
      // condition only becomes true on edit (e.g. "Status equals Converted") still reassigns.
      const assignedTo = applyAssignmentRule('leads', draft);
      const toSave = assignedTo ? { ...draft, ownerId: assignedTo } : draft;
      await upsert('leads', toSave);
      setLead(toSave);
      closeEditor();
      toast.push('success', assignedTo && assignedTo !== lead.ownerId ? 'Lead updated and auto-assigned.' : 'Lead updated.');
    } catch {
      setSaveError('Your changes were not saved. The server did not answer. What you typed is still here; press Save to try again.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const detailsTab = !editing ? (
    <dl className="detail-list">
      <dt>Company</dt>
      <dd data-testid="lead-company">{lead.company || '—'}</dd>
      <dt>Email</dt>
      <dd data-testid="lead-email">{lead.email}</dd>
      <dt>Phone</dt>
      <dd data-testid="lead-phone">{lead.phone || '—'}</dd>
      <dt>Source</dt>
      <dd>{lead.source}</dd>
      <dt>Owner</dt>
      <dd>{ownerName}</dd>
      <dt>Estimated value</dt>
      <dd data-testid="lead-value">{formatCurrency(lead.value)}</dd>
      <dt>Interested product</dt>
      <dd data-testid="lead-product">{product ? <Link to={`/products/${product.id}`}>{product.name}</Link> : '—'}</dd>
      <dt>Campaign</dt>
      <dd data-testid="lead-campaign">{campaign ? <Link to={`/campaigns/${campaign.id}`}>{campaign.name}</Link> : '—'}</dd>
      <dt>Created</dt>
      <dd>{formatDate(lead.createdAt)}</dd>
      <CustomFieldsSection module="leads" target="detail" mode="view" values={lead.customFields ?? {}} />
    </dl>
  ) : (
    draft && (
      <>
        {saveError && (
          <div className="banner banner-error" role="alert" data-testid="lead-save-error">
            {saveError}
          </div>
        )}
        <div className="form-grid">
          <div className="field">
            <label className="field-label" htmlFor="lead-edit-name">Full name *</label>
            <input
              id="lead-edit-name"
              className="input"
              value={draft.name}
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? 'lead-edit-name-error' : undefined}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
            {errors.name && <div id="lead-edit-name-error" className="field-error">{errors.name}</div>}
          </div>
          <div className="field">
            <label className="field-label" htmlFor="lead-edit-company">Company</label>
            <input id="lead-edit-company" className="input" value={draft.company} onChange={(e) => setDraft({ ...draft, company: e.target.value })} />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="lead-edit-email">Email *</label>
            <input
              id="lead-edit-email"
              className="input"
              value={draft.email}
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? 'lead-edit-email-error' : undefined}
              onChange={(e) => setDraft({ ...draft, email: e.target.value })}
            />
            {errors.email && <div id="lead-edit-email-error" className="field-error">{errors.email}</div>}
          </div>
          <div className="field">
            <label className="field-label" htmlFor="lead-edit-phone">Phone</label>
            <input id="lead-edit-phone" className="input" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
          </div>
          <div className="field">
            <span className="field-label">Status</span>
            <Select
              value={draft.status}
              options={getStatusOptions('leads', 'status', LEAD_STATUSES).map((s) => ({ value: s, label: s }))}
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
            <label className="field-label" htmlFor="lead-edit-value">Estimated value ($)</label>
            <input
              id="lead-edit-value"
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
      </>
    )
  );

  return (
    <>
      <RecordShell
        testId="lead-detail-page"
        breadcrumbs={[{ label: 'Leads', to: '/leads' }, { label: lead.name }]}
        title={lead.name}
        keyInfo={[
          { label: 'Status', value: <span className={`pill status-${lead.status.toLowerCase()}`} data-testid="lead-detail-status">{lead.status}</span> },
          { label: 'Company', value: lead.company || '—' },
          { label: 'Source', value: lead.source },
          { label: 'Owner', value: ownerName },
          { label: 'Layout', value: lead.layoutName || '—' },
          { label: 'Created', value: formatDate(lead.createdAt) },
        ]}
        tabs={[{ id: 'details', label: 'Details', content: <div className="card">{detailsTab}</div> }]}
        actions={
          !canChange ? (
            <span className="muted">You have view-only access.</span>
          ) : !editing ? (
            <>
              <button
                className="btn"
                data-testid="edit-lead-btn"
                onClick={() => {
                  setDraft({ ...lead });
                  setEditing(true);
                }}
              >
                <Pencil size={14} /> Edit
              </button>
              <button className="btn btn-danger" data-testid="delete-lead-btn" onClick={() => setDeleting(true)}>
                <Trash2 size={14} /> Delete
              </button>
            </>
          ) : (
            <>
              <button className="btn" onClick={closeEditor}>
                Cancel
              </button>
              <button className="btn btn-primary" data-testid="save-lead-btn" disabled={saving} aria-busy={saving} onClick={save}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </>
          )
        }
      />

      {deleting && (
        <Modal
          title={`Delete ${lead.name}?`}
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
                  toast.push('success', `Lead "${lead.name}" deleted.`);
                  navigate('/leads');
                }}
              >
                Delete lead
              </button>
            </>
          }
        >
          <p>This removes the lead and cannot be undone.</p>
          {lead.status === 'Converted' && (
            <div className="banner banner-info" data-testid="converted-warning">
              This lead is <strong>converted</strong>. The contact, account and deal made from it are <strong>not</strong> deleted.
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
