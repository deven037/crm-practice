import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { getAllSync, newId, upsert } from '../data/store';
import { Account, Contact, CustomFieldDef, PageLayout } from '../types';
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
  const [activeTabId, setActiveTabId] = useState(layout?.tabs[0]?.id ?? '');
  const activeTab = layout?.tabs.find((t) => t.id === activeTabId) ?? layout?.tabs[0];
  const isVisible = (key: string) => !layout || (activeTab?.fieldKeys.includes(key) ?? true)
    || ((key === 'name' || key === 'email') && !layout.tabs.some((tab) => tab.fieldKeys.includes(key)));
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
  const [saveError, setSaveError] = useState(false);
  const canWrite = user?.role === 'admin' || user?.role === 'rep';
  const [duplicate, setDuplicate] = useState<Contact | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (Object.keys(errors).length === 0 && Object.keys(customErrors).length === 0) return;
    formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [errors, customErrors, activeTabId]);

  useEffect(() => {
    const t = setTimeout(() => {
      setDuplicate(findDuplicate('contacts', draft, getAllSync<Contact>('contacts')));
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.email, draft.name]);

  const submit = async () => {
    if (busy || !canWrite) return;
    const errs: typeof errors = {};
    if (!draft.name.trim()) errs.name = 'Name is required.';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(draft.email.trim())) errs.email = 'Enter a valid email.';
    setErrors(errs);
    const cErrs = validateCustomFields('contacts', 'form', draft.customFields ?? {});
    setCustomErrors(cErrs);
    if (Object.keys(errs).length > 0 || Object.keys(cErrs).length > 0) {
      const invalidCustomIds = getAllSync<CustomFieldDef>('customFieldDefs')
        .filter((field) => cErrs[field.key]).map((field) => field.id);
      const invalidTab = layout?.tabs.find((tab) => tab.fieldKeys.some((key) => key in errs || invalidCustomIds.includes(key)));
      if (invalidTab) setActiveTabId(invalidTab.id);
      return;
    }
    setBusy(true);
    setSaveError(false);
    try {
      const saved = await upsert('contacts', draft);
      toast.push('success', `Contact "${saved.name}" created.`);
      navigate(`/contacts/${saved.id}`);
    } catch {
      setSaveError(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="contact-screen" data-testid="contact-form-page">
      <nav className="breadcrumbs">
        <Link to="/contacts">Contacts</Link> <span>/</span> <span>New contact</span>
      </nav>
      <div className="contact-heading">
        <h1>New contact</h1>
        <p className="page-subtitle">Add a person and connect them to an account.</p>
      </div>
      {layout && <p className="muted">Layout: {layout.name}</p>}

      {!canWrite ? <p className="muted">You have read-only access to contacts.</p> : (
      <form className="contact-form" ref={formRef} noValidate onSubmit={(event) => { event.preventDefault(); void submit(); }}>
        <fieldset disabled={busy}>
        {duplicate && (
          <div className="banner banner-info" role="alert" data-testid="duplicate-warning">
            A contact with matching details already exists —{' '}
            <Link to={`/contacts/${duplicate.id}`}>View "{duplicate.name}"</Link>. You can still save this one.
          </div>
        )}
        {layout && layout.tabs.length > 1 && (
          <div className="contact-layout-tabs" data-testid="contact-form-layout-tabs" aria-label="Form layout sections">
            {layout.tabs.map((tab) => (
              <button
                type="button"
                aria-pressed={tab.id === activeTabId}
                key={tab.id}
                className={classNames('tab', tab.id === activeTabId && 'active')}
                onClick={() => setActiveTabId(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}
        <div className="form-grid" aria-live="polite">
          {isVisible('name') && (
            <div className="field">
              <label className="field-label" htmlFor="contact-name">Full name *</label>
              <input
                id="contact-name"
                className="input"
                data-testid="contact-name"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                aria-invalid={errors.name ? true : undefined}
                aria-describedby={errors.name ? 'contact-name-error' : undefined}
              />
              {errors.name && <span className="field-error" id="contact-name-error">{errors.name}</span>}
            </div>
          )}
          {isVisible('email') && (
            <div className="field">
              <label className="field-label" htmlFor="contact-email">Email *</label>
              <input
                id="contact-email"
                className="input"
                data-testid="contact-email"
                value={draft.email}
                onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                aria-invalid={errors.email ? true : undefined}
                aria-describedby={errors.email ? 'contact-email-error' : undefined}
              />
              {errors.email && <span className="field-error" id="contact-email-error">{errors.email}</span>}
            </div>
          )}
          {isVisible('phone') && (
            <div className="field">
              <label className="field-label" htmlFor="contact-phone">Phone</label>
              <input id="contact-phone" className="input" data-testid="contact-phone" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
            </div>
          )}
          {isVisible('title') && (
            <div className="field">
              <label className="field-label" htmlFor="contact-title">Job title</label>
              <input id="contact-title" className="input" data-testid="contact-title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            </div>
          )}
          {isVisible('accountId') && (
            <div className="field">
              <label className="field-label" htmlFor="contact-account">Account</label>
              <SearchableSelect
                id="contact-account"
                value={draft.accountId ?? ''}
                options={accounts.map((a) => ({ value: a.id, label: a.name }))}
                onChange={(v) => setDraft({ ...draft, accountId: v })}
                placeholder="Search accounts…"
                testId="contact-account"
              />
            </div>
          )}
          <div className="field">
            <label className="field-label" htmlFor="contact-tags">Tags</label>
            <MultiSelect
              id="contact-tags"
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

        </fieldset>
        {saveError && <div className="banner banner-error" role="alert">Contact couldn’t be saved. Your details are still here.</div>}
        <div className="form-actions">
          <button type="button" className="btn" disabled={busy} onClick={() => navigate('/contacts')}>
            Cancel
          </button>
          <button type="submit" className="btn contacts-primary" disabled={busy}>
            {busy ? 'Creating…' : 'Create contact'}
          </button>
        </div>
      </form>
      )}
    </div>
  );
}
