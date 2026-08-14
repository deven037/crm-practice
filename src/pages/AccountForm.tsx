import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { getAllSync, newId, upsert } from '../data/store';
import { Account, PageLayout, User } from '../types';
import { Select } from '../components/Select';
import { CustomFieldsSection, validateCustomFields } from '../components/CustomFieldsSection';
import { useToast } from '../components/Toast';
import { useAuth } from '../auth/AuthContext';
import { getCustomFieldsAsModuleFields } from '../utils/moduleFields';
import { classNames } from '../utils';

const INDUSTRIES = ['Technology', 'Finance', 'Healthcare', 'Retail', 'Manufacturing', 'Energy', 'Logistics', 'Media'];

export function AccountForm() {
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const [params] = useSearchParams();
  const users = getAllSync<User>('users');

  const layouts = getAllSync<PageLayout>('pageLayouts').filter((l) => l.module === 'accounts');
  const layout = layouts.find((l) => l.id === params.get('layout')) ?? layouts.find((l) => l.isDefault) ?? layouts[0];
  const allLayoutKeys = new Set(layout?.tabs.flatMap((t) => t.fieldKeys) ?? []);
  const [activeTabId, setActiveTabId] = useState(layout?.tabs[0]?.id ?? '');
  const activeTab = layout?.tabs.find((t) => t.id === activeTabId) ?? layout?.tabs[0];
  const isVisible = (key: string) => !layout || (activeTab?.fieldKeys.includes(key) ?? true);
  const customFieldIds = new Set(getCustomFieldsAsModuleFields('accounts').map((f) => f.key));
  const activeTabCustomIds = activeTab?.fieldKeys.filter((k) => customFieldIds.has(k)) ?? [];

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
  const [customErrors, setCustomErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const errs: typeof errors = {};
    if (allLayoutKeys.has('name') && !draft.name.trim()) errs.name = 'Account name is required.';
    if (draft.website && !/^https?:\/\/.+\..+/.test(draft.website.trim())) errs.website = 'Enter a valid URL (starting with http:// or https://).';
    setErrors(errs);
    const cErrs = validateCustomFields('accounts', 'form', draft.customFields ?? {});
    setCustomErrors(cErrs);
    if (Object.keys(errs).length > 0 || Object.keys(cErrs).length > 0) return;
    setBusy(true);
    await upsert('accounts', draft);
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
      {layout && <p className="muted" style={{ marginTop: -8 }}>Layout: {layout.name}</p>}

      <div className="card form-card">
        {layout && layout.tabs.length > 1 && (
          <div className="chip-filters" data-testid="account-form-layout-tabs" style={{ marginBottom: 16 }}>
            {layout.tabs.map((tab) => (
              <span
                key={tab.id}
                className={classNames('chip-filter', tab.id === activeTabId && 'active')}
                style={{ cursor: 'pointer' }}
                onClick={() => setActiveTabId(tab.id)}
              >
                {tab.label}
              </span>
            ))}
          </div>
        )}
        <div className="form-grid">
          {isVisible('name') && (
            <div className="field">
              <span className="field-label">Account name *</span>
              <input className="input" data-testid="account-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              {errors.name && <span className="field-error">{errors.name}</span>}
            </div>
          )}
          {isVisible('industry') && (
            <div className="field">
              <span className="field-label">Industry</span>
              <Select
                value={draft.industry}
                options={INDUSTRIES.map((i) => ({ value: i, label: i }))}
                onChange={(v) => setDraft({ ...draft, industry: v })}
                testId="account-industry"
              />
            </div>
          )}
          {isVisible('employees') && (
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
          )}
          {isVisible('revenue') && (
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
          )}
          {isVisible('website') && (
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
          )}
          {isVisible('phone') && (
            <div className="field">
              <span className="field-label">Phone</span>
              <input className="input" data-testid="account-phone" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
            </div>
          )}
          {isVisible('ownerId') && (
            <div className="field">
              <span className="field-label">Owner</span>
              <Select
                value={draft.ownerId}
                options={users.map((u) => ({ value: u.id, label: u.name }))}
                onChange={(v) => setDraft({ ...draft, ownerId: v })}
              />
            </div>
          )}
          <CustomFieldsSection
            module="accounts"
            target="form"
            mode="edit"
            values={draft.customFields ?? {}}
            onChange={(k, v) => setDraft({ ...draft, customFields: { ...draft.customFields, [k]: v } })}
            errors={customErrors}
            includeIds={layout ? activeTabCustomIds : undefined}
          />
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
