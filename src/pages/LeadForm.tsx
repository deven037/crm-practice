import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { getAllSync, newId, upsert, logAudit } from '../data/store';
import { Lead, LeadStatus, LEAD_SOURCES, LEAD_STATUSES, Product, User } from '../types';
import { SearchableSelect, Select } from '../components/Select';
import { useToast } from '../components/Toast';
import { useAuth } from '../auth/AuthContext';

export function LeadForm() {
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const [params] = useSearchParams();

  const users = getAllSync<User>('users');
  const products = getAllSync<Product>('products');

  const [draft, setDraft] = useState<Lead>({
    id: newId('lead'),
    name: '',
    company: '',
    email: '',
    phone: '',
    status: 'New',
    source: 'Web',
    ownerId: user?.id ?? 'user-2',
    value: 0,
    productId: params.get('productId'),
    createdAt: new Date().toISOString(),
  });
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const errs: typeof errors = {};
    if (!draft.name.trim()) errs.name = 'Name is required.';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(draft.email.trim())) errs.email = 'Enter a valid email.';
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setBusy(true);
    await upsert('leads', draft);
    logAudit(user?.name ?? 'Unknown', 'lead.create', `Created lead ${draft.name}`);
    toast.push('success', `Lead "${draft.name}" created.`);
    navigate(`/leads/${draft.id}`);
  };

  return (
    <div data-testid="lead-form-page">
      <nav className="breadcrumbs">
        <Link to="/leads">Leads</Link> <span>/</span> <span>New lead</span>
      </nav>
      <div className="page-header">
        <h1>New lead</h1>
      </div>

      <div className="card form-card">
        <div className="form-grid">
          <div className="field">
            <span className="field-label">Full name *</span>
            <input className="input" data-testid="lead-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            {errors.name && <span className="field-error">{errors.name}</span>}
          </div>
          <div className="field">
            <span className="field-label">Company</span>
            <input className="input" data-testid="lead-company" value={draft.company} onChange={(e) => setDraft({ ...draft, company: e.target.value })} />
          </div>
          <div className="field">
            <span className="field-label">Email *</span>
            <input className="input" data-testid="lead-email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
            {errors.email && <span className="field-error">{errors.email}</span>}
          </div>
          <div className="field">
            <span className="field-label">Phone</span>
            <input className="input" data-testid="lead-phone" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
          </div>
          <div className="field">
            <span className="field-label">Status</span>
            <Select
              value={draft.status}
              options={LEAD_STATUSES.map((s) => ({ value: s, label: s }))}
              onChange={(v) => setDraft({ ...draft, status: v as LeadStatus })}
              testId="lead-status"
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
              testId="lead-product"
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
              data-testid="lead-value"
              value={draft.value}
              onChange={(e) => setDraft({ ...draft, value: Number(e.target.value) })}
            />
          </div>
        </div>
        <div className="form-actions">
          <button className="btn" onClick={() => navigate('/leads')}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={busy} onClick={submit}>
            {busy ? 'Creating…' : 'Create lead'}
          </button>
        </div>
      </div>
    </div>
  );
}
