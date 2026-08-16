import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { getAllSync, newId, upsert } from '../data/store';
import { Account, Contact, PageLayout } from '../types';
import { MultiSelect, SearchableSelect } from '../components/Select';
import { CustomFieldsSection, validateCustomFields } from '../components/CustomFieldsSection';
import { useToast } from '../components/Toast';
import { useAuth } from '../auth/AuthContext';
import { findDuplicate } from '../utils/rules';
import { getCustomFieldsAsModuleFields } from '../utils/moduleFields';
import { classNames } from '../utils';

const TAG_OPTIONS = ['vip', 'newsletter', 'partner', 'decision-maker', 'follow-up', 'imported'].map((t) => ({
  value: t,
  label: t,
}));

export function ContactForm() {
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const [params] = useSearchParams();
  const accounts = getAllSync<Account>('accounts');

  const layouts = getAllSync<PageLayout>('pageLayouts').filter((l) => l.module === 'contacts');
  const layout = layouts.find((l) => l.id === params.get('layout')) ?? layouts.find((l) => l.isDefault) ?? layouts[0];
  const allLayoutKeys = new Set(layout?.tabs.flatMap((t) => t.fieldKeys) ?? []);
  const [activeTabId, setActiveTabId] = useState(layout?.tabs[0]?.id ?? '');
  const activeTab = layout?.tabs.find((t) => t.id === activeTabId) ?? layout?.tabs[0];
  const isVisible = (key: string) => !layout || (activeTab?.fieldKeys.includes(key) ?? true);
  const customFieldIds = new Set(getCustomFieldsAsModuleFields('contacts').map((f) => f.key));
  const activeTabCustomIds = activeTab?.fieldKeys.filter((k) => customFieldIds.has(k)) ?? [];

  const [draft, setDraft] = useState<Contact>({
    id: newId('contact'),
    name: '',
    email: '',
    phone: '',
    accountId: null,
    title: '',
    tags: [],
    avatar: null,
    notes: [],
    files: [],
    layoutName: layout?.name ?? null,
    createdAt: new Date().toISOString(),
  });
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});
  const [customErrors, setCustomErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [duplicate, setDuplicate] = useState<Contact | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setDuplicate(findDuplicate('contacts', draft, getAllSync<Contact>('contacts')));
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.email, draft.name]);

  const submit = async () => {
    const errs: typeof errors = {};
    if (allLayoutKeys.has('name') && !draft.name.trim()) errs.name = 'Name is required.';
    if (allLayoutKeys.has('email') && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(draft.email.trim())) errs.email = 'Enter a valid email.';
    setErrors(errs);
    const cErrs = validateCustomFields('contacts', 'form', draft.customFields ?? {});
    setCustomErrors(cErrs);
    if (Object.keys(errs).length > 0 || Object.keys(cErrs).length > 0) return;
    setBusy(true);
    await upsert('contacts', draft);
    toast.push('success', `Contact "${draft.name}" created.`);
    navigate(`/contacts/${draft.id}`);
  };

  return (
    <div data-testid="contact-form-page">
      <nav className="breadcrumbs">
        <Link to="/contacts">Contacts</Link> <span>/</span> <span>New contact</span>
      </nav>
      <div className="page-header">
        <h1>New contact</h1>
      </div>
      {layout && <p className="muted" style={{ marginTop: -8 }}>Layout: {layout.name}</p>}

      <div className="card form-card">
        {duplicate && (
          <div className="banner banner-info" role="alert" data-testid="duplicate-warning">
            A contact with matching details already exists —{' '}
            <Link to={`/contacts/${duplicate.id}`}>View "{duplicate.name}"</Link>. You can still save this one.
          </div>
        )}
        {layout && layout.tabs.length > 1 && (
          <div className="chip-filters" data-testid="contact-form-layout-tabs" style={{ marginBottom: 16 }}>
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
              <span className="field-label">Full name *</span>
              <input className="input" data-testid="contact-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              {errors.name && <span className="field-error">{errors.name}</span>}
            </div>
          )}
          {isVisible('email') && (
            <div className="field">
              <span className="field-label">Email *</span>
              <input className="input" data-testid="contact-email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
              {errors.email && <span className="field-error">{errors.email}</span>}
            </div>
          )}
          {isVisible('phone') && (
            <div className="field">
              <span className="field-label">Phone</span>
              <input className="input" data-testid="contact-phone" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
            </div>
          )}
          {isVisible('title') && (
            <div className="field">
              <span className="field-label">Job title</span>
              <input className="input" data-testid="contact-title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            </div>
          )}
          {isVisible('accountId') && (
            <div className="field">
              <span className="field-label">Account</span>
              <SearchableSelect
                value={draft.accountId ?? ''}
                options={accounts.map((a) => ({ value: a.id, label: a.name }))}
                onChange={(v) => setDraft({ ...draft, accountId: v })}
                placeholder="Search accounts…"
                testId="contact-account"
              />
            </div>
          )}
          <div className="field">
            <span className="field-label">Tags</span>
            <MultiSelect
              values={draft.tags}
              options={TAG_OPTIONS}
              onChange={(tags) => setDraft({ ...draft, tags })}
              placeholder="Add tags…"
              testId="contact-tags"
            />
          </div>
          <CustomFieldsSection
            module="contacts"
            target="form"
            mode="edit"
            values={draft.customFields ?? {}}
            onChange={(k, v) => setDraft({ ...draft, customFields: { ...draft.customFields, [k]: v } })}
            errors={customErrors}
            includeIds={layout ? activeTabCustomIds : undefined}
          />
        </div>

        <div className="form-actions">
          <button className="btn" onClick={() => navigate('/contacts')}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={busy} onClick={submit}>
            {busy ? 'Creating…' : 'Create contact'}
          </button>
        </div>
      </div>
    </div>
  );
}
