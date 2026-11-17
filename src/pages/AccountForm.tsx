import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { getAllSync, newId, upsert } from '../data/store';
import { Account, CustomFieldDef, PageLayout, User } from '../types';
import { Select } from '../components/Select';
import { CustomFieldsSection, validateCustomFields } from '../components/CustomFieldsSection';
import { useToast } from '../components/Toast';
import { useAuth } from '../auth/AuthContext';
import { getCustomFieldsAsModuleFields } from '../utils/moduleFields';
import { classNames } from '../utils';
import { runRecoverable } from './accountRecovery';
import { AccountTilePreview } from './accounts/accountBits';

const INDUSTRIES = ['Technology', 'Finance', 'Healthcare', 'Retail', 'Manufacturing', 'Energy', 'Logistics', 'Media'];

/**
 * The account form, as a full page with a live tile beside it. With no `existing` account it creates one;
 * with one (see AccountEdit) it saves changes to it.
 */
export function AccountForm({ existing }: { existing?: Account } = {}) {
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const [params] = useSearchParams();
  const users = getAllSync<User>('users');

  const layouts = getAllSync<PageLayout>('pageLayouts').filter((l) => l.module === 'accounts');
  const layout = layouts.find((l) => l.id === params.get('layout'))
    ?? (existing ? layouts.find((l) => l.name === existing.layoutName) : undefined)
    ?? layouts.find((l) => l.isDefault) ?? layouts[0];
  const allLayoutKeys = new Set(layout?.tabs.flatMap((t) => t.fieldKeys) ?? []);
  // The order of these states is relied on by the form tests; add new ones at the end.
  const [activeTabId, setActiveTabId] = useState(layout?.tabs[0]?.id ?? '');
  const activeTab = layout?.tabs.find((t) => t.id === activeTabId) ?? layout?.tabs[0];
  const isVisible = (key: string) => !layout || (activeTab?.fieldKeys.includes(key) ?? true);
  const customFieldIds = new Set(getCustomFieldsAsModuleFields('accounts').map((f) => f.key));
  const activeTabCustomIds = activeTab?.fieldKeys.filter((k) => customFieldIds.has(k)) ?? [];

  const [draft, setDraft] = useState<Account>(existing ? { ...existing } : {
    id: newId('account'),
    name: '',
    industry: 'Technology',
    employees: 0,
    revenue: 0,
    website: '',
    phone: '',
    ownerId: user?.id ?? 'user-2',
    layoutName: layout?.name ?? null,
    createdAt: new Date().toISOString(),
  });
  const [errors, setErrors] = useState<{ name?: string; website?: string; employees?: string; revenue?: string }>({});
  const [customErrors, setCustomErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState(false);

  useEffect(() => {
    if (Object.keys(errors).length || Object.keys(customErrors).length) {
      document.querySelector<HTMLElement>('[data-testid="account-form-page"] [aria-invalid="true"]')?.focus();
    }
  }, [errors, customErrors]);

  const backTo = existing ? `/accounts/${existing.id}` : '/accounts';
  const industries = INDUSTRIES.includes(draft.industry) || !draft.industry ? INDUSTRIES : [draft.industry, ...INDUSTRIES];

  const submit = async () => {
    const errs: typeof errors = {};
    if ((existing || allLayoutKeys.has('name')) && !draft.name.trim()) errs.name = 'Account name is required.';
    if (draft.website && !/^https?:\/\/.+\..+/.test(draft.website.trim())) errs.website = 'Enter a valid URL (starting with http:// or https://).';
    if (draft.employees < 0) errs.employees = 'Employees can’t be negative.';
    if (draft.revenue < 0) errs.revenue = 'Annual revenue can’t be negative.';
    setErrors(errs);
    const cErrs = validateCustomFields('accounts', 'form', draft.customFields ?? {});
    setCustomErrors(cErrs);
    if (Object.keys(errs).length > 0 || Object.keys(cErrs).length > 0) {
      const firstStandard = ['name', 'employees', 'revenue', 'website'].find((key) => Object.keys(errs).includes(key));
      const firstCustom = getAllSync<CustomFieldDef>('customFieldDefs')
        .find((field) => field.module === 'accounts' && cErrs[field.key]);
      const firstKey = firstStandard ?? firstCustom?.id;
      const tab = layout?.tabs.find((item) => item.fieldKeys.includes(firstKey ?? ''));
      if (tab) setActiveTabId(tab.id);
      return;
    }
    const saved = await runRecoverable(() => upsert('accounts', draft), { setBusy, setError: setSaveError });
    if (!saved) return;
    toast.push('success', existing ? 'Account updated.' : `Account "${draft.name}" created.`);
    navigate(`/accounts/${draft.id}`);
  };

  return (
    <div className="acct3 acct-form-page" data-testid="account-form-page">
      <Link to={backTo} className="contact-back"><ChevronLeft size={16} aria-hidden="true" /> {existing ? existing.name : 'Accounts'}</Link>

      <div className="acct-fcols">
        <div className="card acct-formcard">
          <div className="acct-fhead">
            <h1>{existing ? 'Edit account' : 'New account'}</h1>
            <p>{layout ? `Layout: ${layout.name}` : 'A customer organisation that contacts, deals and quotes are tied to.'}</p>
          </div>

          {layout && layout.tabs.length > 1 && (
            <div className="contact-layout-tabs" data-testid="account-form-layout-tabs" aria-label="Form layout sections">
              {layout.tabs.map((tab) => (
                <button
                  type="button"
                  key={tab.id}
                  aria-pressed={tab.id === activeTabId}
                  className={classNames('contact-ltab', tab.id === activeTabId && 'active')}
                  onClick={() => setActiveTabId(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}

          <div className="acct-fields">
            <div className="form-grid">
              {isVisible('name') && (
                <div className="field field-span">
                  <label className="field-label" htmlFor="account-name-input">Account name *</label>
                  <input
                    id="account-name-input"
                    className="input"
                    data-testid="account-name"
                    aria-invalid={errors.name ? true : undefined}
                    aria-describedby={errors.name ? 'account-name-error' : undefined}
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  />
                  {errors.name && <span className="field-error" id="account-name-error">{errors.name}</span>}
                </div>
              )}
              {isVisible('industry') && (
                <div className="field">
                  <label className="field-label" htmlFor="account-industry-input">Industry</label>
                  <Select
                    id="account-industry-input"
                    value={draft.industry}
                    options={industries.map((i) => ({ value: i, label: i }))}
                    onChange={(v) => setDraft({ ...draft, industry: v })}
                    testId="account-industry"
                  />
                </div>
              )}
              {isVisible('ownerId') && (
                <div className="field">
                  <label className="field-label" htmlFor="account-owner-input">Owner</label>
                  <Select
                    id="account-owner-input"
                    value={draft.ownerId}
                    options={users.map((u) => ({ value: u.id, label: u.name }))}
                    onChange={(v) => setDraft({ ...draft, ownerId: v })}
                  />
                </div>
              )}
              {isVisible('employees') && (
                <div className="field">
                  <label className="field-label" htmlFor="account-employees-input">Employees</label>
                  <input
                    id="account-employees-input"
                    className="input"
                    type="number"
                    data-testid="account-employees"
                    aria-invalid={errors.employees ? true : undefined}
                    aria-describedby={errors.employees ? 'account-employees-error' : undefined}
                    value={draft.employees}
                    onChange={(e) => setDraft({ ...draft, employees: Number(e.target.value) })}
                  />
                  {errors.employees && <span className="field-error" id="account-employees-error">{errors.employees}</span>}
                </div>
              )}
              {isVisible('revenue') && (
                <div className="field">
                  <label className="field-label" htmlFor="account-revenue-input">Annual revenue ($)</label>
                  <input
                    id="account-revenue-input"
                    className="input"
                    type="number"
                    data-testid="account-revenue"
                    aria-invalid={errors.revenue ? true : undefined}
                    aria-describedby={errors.revenue ? 'account-revenue-error' : undefined}
                    value={draft.revenue}
                    onChange={(e) => setDraft({ ...draft, revenue: Number(e.target.value) })}
                  />
                  {errors.revenue && <span className="field-error" id="account-revenue-error">{errors.revenue}</span>}
                </div>
              )}
              {isVisible('website') && (
                <div className="field">
                  <label className="field-label" htmlFor="account-website-input">Website</label>
                  <input
                    id="account-website-input"
                    className="input"
                    data-testid="account-website"
                    placeholder="https://…"
                    aria-invalid={errors.website ? true : undefined}
                    aria-describedby={errors.website ? 'account-website-error' : undefined}
                    value={draft.website}
                    onChange={(e) => setDraft({ ...draft, website: e.target.value })}
                  />
                  {errors.website && <span className="field-error" id="account-website-error">{errors.website}</span>}
                </div>
              )}
              {isVisible('phone') && (
                <div className="field">
                  <label className="field-label" htmlFor="account-phone-input">Phone</label>
                  <input id="account-phone-input" className="input" data-testid="account-phone" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
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
          </div>

          {saveError && (
            <div className="banner banner-error acct-form-note" role="alert" data-testid="save-account-error">
              Account couldn’t be saved. Your entries are kept. Try again.
            </div>
          )}
          <div className="form-actions contact-form-actions">
            <button className="btn" disabled={busy} onClick={() => navigate(backTo)}>
              Cancel
            </button>
            <button className="btn btn-primary contacts-primary" data-testid="save-account-btn" disabled={busy} onClick={submit}>
              {busy ? (existing ? 'Saving…' : 'Creating…') : existing ? 'Save changes' : 'Create account'}
            </button>
          </div>
        </div>

        <AccountTilePreview
          id={draft.id}
          name={draft.name}
          industry={draft.industry}
          revenue={draft.revenue}
          owner={users.find((u) => u.id === draft.ownerId)?.name ?? ''}
        />
      </div>
    </div>
  );
}
