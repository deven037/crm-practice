import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getAllSync, newId, upsert, logAudit } from '../data/store';
import { Account, User } from '../types';
import { Select } from '../components/Select';
import { useToast } from '../components/Toast';
import { useAuth } from '../auth/AuthContext';

const INDUSTRIES = ['Technology', 'Finance', 'Healthcare', 'Retail', 'Manufacturing', 'Energy', 'Logistics', 'Media'];

export function AccountForm() {
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const users = getAllSync<User>('users');

  const [draft, setDraft] = useState<Account>({
    id: newId('account'),
    name: '',
    industry: 'Technology',
    employees: 0,
    revenue: 0,
    website: '',
    phone: '',
    ownerId: user?.id ?? 'user-2',
    createdAt: new Date().toISOString(),
  });
  const [errors, setErrors] = useState<{ name?: string; website?: string }>({});
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const errs: typeof errors = {};
    if (!draft.name.trim()) errs.name = 'Account name is required.';
    if (draft.website && !/^https?:\/\/.+\..+/.test(draft.website.trim())) errs.website = 'Enter a valid URL (starting with http:// or https://).';
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setBusy(true);
    await upsert('accounts', draft);
    logAudit(user?.name ?? 'Unknown', 'account.create', `Created account ${draft.name}`);
    toast.push('success', `Account "${draft.name}" created.`);
    navigate(`/accounts/${draft.id}`);
  };

  return (
    <div data-testid="account-form-page">
      <nav className="breadcrumbs">
        <Link to="/accounts">Accounts</Link> <span>/</span> <span>New account</span>
      </nav>
      <div className="page-header">
        <h1>New account</h1>
      </div>

      <div className="card form-card">
        <div className="form-grid">
          <div className="field">
            <span className="field-label">Account name *</span>
            <input className="input" data-testid="account-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            {errors.name && <span className="field-error">{errors.name}</span>}
          </div>
          <div className="field">
            <span className="field-label">Industry</span>
            <Select
              value={draft.industry}
              options={INDUSTRIES.map((i) => ({ value: i, label: i }))}
              onChange={(v) => setDraft({ ...draft, industry: v })}
              testId="account-industry"
            />
          </div>
          <div className="field">
            <span className="field-label">Employees</span>
            <input
              className="input"
              type="number"
              data-testid="account-employees"
              value={draft.employees}
              onChange={(e) => setDraft({ ...draft, employees: Number(e.target.value) })}
            />
          </div>
          <div className="field">
            <span className="field-label">Annual revenue ($)</span>
            <input
              className="input"
              type="number"
              data-testid="account-revenue"
              value={draft.revenue}
              onChange={(e) => setDraft({ ...draft, revenue: Number(e.target.value) })}
            />
          </div>
          <div className="field">
            <span className="field-label">Website</span>
            <input
              className="input"
              data-testid="account-website"
              placeholder="https://…"
              value={draft.website}
              onChange={(e) => setDraft({ ...draft, website: e.target.value })}
            />
            {errors.website && <span className="field-error">{errors.website}</span>}
          </div>
          <div className="field">
            <span className="field-label">Phone</span>
            <input className="input" data-testid="account-phone" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
          </div>
          <div className="field">
            <span className="field-label">Owner</span>
            <Select
              value={draft.ownerId}
              options={users.map((u) => ({ value: u.id, label: u.name }))}
              onChange={(v) => setDraft({ ...draft, ownerId: v })}
            />
          </div>
        </div>
        <div className="form-actions">
          <button className="btn" onClick={() => navigate('/accounts')}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={busy} onClick={submit}>
            {busy ? 'Creating…' : 'Create account'}
          </button>
        </div>
      </div>
    </div>
  );
}
