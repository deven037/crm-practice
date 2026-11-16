import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Mail, Pencil, Phone, Trash2 } from 'lucide-react';
import { getAllSync, getById, removeMany, upsert } from '../data/store';
import { Account, Campaign, Lead, LeadStatus, LEAD_SOURCES, LEAD_STATUSES, Product, User } from '../types';
import { apiFetch } from '../data/apiFetch';
import { LeadConvertWizard, WizardState } from './leads/LeadConvertWizard';
import { Modal } from '../components/Modal';
import { SearchableSelect, Select } from '../components/Select';
import { CustomFieldsSection, validateCustomFields } from '../components/CustomFieldsSection';
import { Spinner } from '../components/Spinner';
import { useToast } from '../components/Toast';
import { useAuth } from '../auth/AuthContext';
import { useRecentlyViewed } from '../hooks/useRecentlyViewed';
import { formatCurrency, formatDate, initials } from '../utils';
import { applyAssignmentRule, getStatusOptions } from '../utils/rules';
import { beginOnce, canChangeLeads, LeadEditErrors, validateLeadEdit } from './leads/leadsGuards';
import { StatusPicker } from './leads/StatusPicker';

/** The four standard points on a lead's progress line. */
export const LEAD_STAGES = ['New', 'Contacted', 'Qualified', 'Converted'];

/**
 * Where a status sits on the progress line: 0 to 3 for the standard statuses,
 * -1 for Unqualified (the line stops), and 1 for a status a bank added itself
 * (in progress, between New and Qualified).
 */
export function leadStage(status: string): number {
  if (status === 'Unqualified') return -1;
  const at = LEAD_STAGES.indexOf(status);
  return at >= 0 ? at : 1;
}

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
  const [wizard, setWizard] = useState<WizardState | null>(null);
  const [converting, setConverting] = useState(false);
  const [conversionError, setConversionError] = useState('');
  const convertingRef = useRef(false);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { recordView, removeViews } = useRecentlyViewed();
  const canChange = canChangeLeads(user?.role);

  useEffect(() => {
    (async () => {
      const l = await getById<Lead>('leads', id ?? '');
      if (!l) {
        setNotFound(true);
        removeViews([id ?? '']);
      } else setLead(l);
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

  const allLeads = getAllSync<Lead>('leads');
  const position = allLeads.findIndex((l) => l.id === lead.id);
  const previous = position > 0 ? allLeads[position - 1] : undefined;
  const next = position >= 0 ? allLeads[position + 1] : undefined;
  const stage = leadStage(lead.status);

  // The status tag in the header changes the status on its own, without opening Edit.
  // Converted is not offered: that happens through Convert lead.
  const changeStatus = async (status: string) => {
    if (status === lead.status || !beginOnce(savingRef)) return;
    try {
      const updated = { ...lead, status: status as LeadStatus };
      const assignedTo = applyAssignmentRule('leads', updated);
      const toSave = assignedTo ? { ...updated, ownerId: assignedTo } : updated;
      await upsert('leads', toSave);
      setLead(toSave);
      toast.push('success', `Status changed to ${status}.`);
    } catch {
      toast.push('error', 'The status was not changed. Try again.');
    } finally {
      savingRef.current = false;
    }
  };

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

  const openConversion = () => {
    setConversionError('');
    setWizard({
      lead, step: 1, contactName: lead.name, contactEmail: lead.email,
      contactPhone: lead.phone, accountMode: 'new', accountName: lead.company,
      existingAccountId: '', createDeal: false, dealName: `${lead.company} New Business`,
      dealAmount: lead.value, dealStage: 'Qualification',
    });
  };

  const finishConversion = async () => {
    if (!wizard || !beginOnce(convertingRef)) return;
    setConverting(true);
    setConversionError('');
    try {
      const { lead: converted } = await apiFetch<{ lead: Lead }>(`/leads/${lead.id}/convert`, {
        method: 'POST',
        body: JSON.stringify({
          accountMode: wizard.accountMode, existingAccountId: wizard.existingAccountId,
          accountName: wizard.accountName, contactName: wizard.contactName,
          contactEmail: wizard.contactEmail, contactPhone: wizard.contactPhone,
          createDeal: wizard.createDeal, dealName: wizard.dealName,
          dealAmount: wizard.dealAmount, dealStage: wizard.dealStage,
        }),
      });
      setLead(converted);
      setWizard({ ...wizard, done: true });
      toast.push('success', `Lead "${lead.name}" converted successfully.`);
    } catch (error) {
      setConversionError(error instanceof Error ? error.message : 'Lead was not converted. Try Finish conversion again.');
    } finally {
      convertingRef.current = false;
      setConverting(false);
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
      <dt>Page layout</dt>
      <dd>{lead.layoutName || '—'}</dd>
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

  const statusPill = (
    <span className={`pill status-${lead.status.toLowerCase()}`} data-testid="lead-detail-status">{lead.status}</span>
  );
  const actions = !canChange ? (
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
      {lead.status !== 'Converted' && (
        <button className="btn btn-primary" onClick={openConversion}>Convert lead…</button>
      )}
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
  );

  return (
    <>
      <div className="lead-record lead3" data-testid="lead-detail-page">
        <div className="lead-record-top">
          <Link className="lead-back" to="/leads">
            <ChevronLeft size={15} /> All leads
          </Link>
          <span className="lead-nav">
            <button className="btn" aria-label="Previous lead" disabled={!previous} onClick={() => previous && navigate(`/leads/${previous.id}`)}>
              <ChevronLeft size={15} />
            </button>
            <button className="btn" aria-label="Next lead" disabled={!next} onClick={() => next && navigate(`/leads/${next.id}`)}>
              <ChevronRight size={15} />
            </button>
          </span>
        </div>

        <div className="card lead-hero">
          <span className="lead-avatar large" aria-hidden="true">{initials(lead.name)}</span>
          <div className="lead-hero-text">
            <h1>{lead.name}</h1>
            <p className="muted">{[lead.company, lead.source].filter(Boolean).join(' · ')}</p>
          </div>
          {canChange && !editing && lead.status !== 'Converted' ? (
            <StatusPicker
              options={getStatusOptions('leads', 'status', LEAD_STATUSES).filter((status) => status !== 'Converted')}
              selected={[lead.status]}
              label="Change status"
              className="lead-status-btn"
              testId="lead-status-change"
              onPick={changeStatus}
            >
              {statusPill}
            </StatusPicker>
          ) : (
            statusPill
          )}
          <div className="page-actions">{actions}</div>
        </div>

        <ol className={`card lead-steps${stage < 0 ? ' stopped' : ''}`} aria-label="Progress" data-testid="lead-progress">
          {LEAD_STAGES.map((label, i) => (
            <li key={label} className={stage > i ? 'done' : stage === i ? 'now' : undefined} aria-current={stage === i ? 'step' : undefined}>
              {label}
            </li>
          ))}
        </ol>

        <div className="lead-cols">
          <div className="card lead-box">
            <h2>Details</h2>
            {detailsTab}
          </div>
          <div className="lead-side">
            <div className="card lead-box">
              <span className="lead-eyebrow">Estimated value</span>
              <div className="lead-big">{formatCurrency(lead.value)}</div>
              <p className="muted">{product ? product.name : 'No product chosen'} · owner {ownerName}</p>
            </div>
            <div className="card lead-box">
              <h2>Reach out</h2>
              <div className="lead-reach">
                {lead.phone ? (
                  <a className="btn" href={`tel:${lead.phone}`}>
                    <Phone size={16} /> Call <small>{lead.phone}</small>
                  </a>
                ) : (
                  <span className="muted">No phone number on this lead.</span>
                )}
                <a className="btn" href={`mailto:${lead.email}`}>
                  <Mail size={16} /> Email <small>{lead.email}</small>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {wizard && (
        <LeadConvertWizard
          wizard={wizard}
          setWizard={(next) => { if (!convertingRef.current) setWizard(next); }}
          accounts={getAllSync<Account>('accounts')}
          onFinish={finishConversion}
          isFinishing={converting}
          error={conversionError}
          doneActions={
            <>
              <button className="btn" onClick={() => navigate('/leads')}>Back to leads</button>
              <button className="btn btn-primary" onClick={() => setWizard(null)}>View the lead</button>
            </>
          }
        />
      )}

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
                  removeViews([lead.id]);
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
