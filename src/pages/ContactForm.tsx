import { ChangeEvent, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Camera, ChevronLeft } from 'lucide-react';
import { getAllSync, newId, upsert } from '../data/store';
import { Account, Contact, CustomFieldDef, PageLayout } from '../types';
import { SearchableSelect } from '../components/Select';
import { CustomFieldsSection, validateCustomFields } from '../components/CustomFieldsSection';
import { useToast } from '../components/Toast';
import { useAuth } from '../auth/AuthContext';
import { findDuplicate } from '../utils/rules';
import { getCustomFieldsAsModuleFields } from '../utils/moduleFields';
import { classNames } from '../utils';
import { allContactTags, ContactFace, hueStyle, TagInput } from './contacts/contactBits';

/** The new-contact page. It is laid out like the profile it will become: photo and name on top, the layout's sections as tabs. */
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
    || ((key === 'name' || key === 'email' || key === 'tags') && !layout.tabs.some((tab) => tab.fieldKeys.includes(key)));
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
    const cErrs = validateCustomFields('contacts', 'form', draft.customFields ?? {}, layout?.tabs.flatMap((tab) => tab.fieldKeys));
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

  const onPhoto = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setDraft((d) => ({ ...d, avatar: String(reader.result) }));
    reader.readAsDataURL(file);
  };

  return (
    <div className="contact3 contact-form-page" data-testid="contact-form-page" style={hueStyle(draft.id)}>
      <Link to="/contacts" className="contact-back"><ChevronLeft size={16} aria-hidden="true" /> Contacts</Link>

      {!canWrite ? (
        <>
          <div className="page-header"><h1>New contact</h1></div>
          <p className="muted">You have read-only access to contacts.</p>
        </>
      ) : (
      <form className="card contact-formcard contact-form" ref={formRef} noValidate onSubmit={(event) => { event.preventDefault(); void submit(); }}>
        <div className="contact-band" />
        <div className="contact-cover-top">
          <span className="contact-photo">
            <ContactFace contact={draft} size="large" />
            <label
              className="contact-cam"
              title="Choose photo"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.currentTarget.querySelector('input')?.click();
                }
              }}
            >
              <Camera size={15} aria-hidden="true" />
              <span className="sr-only">Choose photo</span>
              <input type="file" accept="image/*" hidden data-testid="contact-photo-input" onChange={onPhoto} />
            </label>
          </span>
          <div className="contact-ident">
            <h1>{draft.name.trim() || 'New contact'}</h1>
            <p>{layout ? `Layout: ${layout.name}` : 'Add a person and connect them to an account.'}</p>
          </div>
        </div>

        {layout && layout.tabs.length > 1 && (
          <div className="contact-layout-tabs" data-testid="contact-form-layout-tabs" aria-label="Form layout sections">
            {layout.tabs.map((tab) => (
              <button
                type="button"
                aria-pressed={tab.id === activeTabId}
                key={tab.id}
                className={classNames('contact-ltab', tab.id === activeTabId && 'active')}
                onClick={() => setActiveTabId(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        <fieldset className="contact-fields" disabled={busy}>
        {duplicate && (
          <div className="banner banner-info" role="alert" data-testid="duplicate-warning">
            A contact with matching details already exists —{' '}
            <Link to={`/contacts/${duplicate.id}`}>View "{duplicate.name}"</Link>. You can still save this one.
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
            <div className="field field-span">
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
          {isVisible('tags') && <div className="field field-span">
            <label className="field-label" htmlFor="contact-tags">Tags</label>
            <TagInput
              id="contact-tags"
              testId="contact-tags"
              tags={draft.tags}
              suggestions={allContactTags(getAllSync<Contact>('contacts'))}
              onChange={(tags) => setDraft({ ...draft, tags })}
            />
          </div>}
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
        {saveError && <div className="banner banner-error contact-form-note" role="alert">Contact couldn’t be saved. Your details are still here.</div>}
        <div className="form-actions contact-form-actions">
          <button type="button" className="btn" disabled={busy} onClick={() => navigate('/contacts')}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary contacts-primary" disabled={busy}>
            {busy ? 'Creating…' : 'Create contact'}
          </button>
        </div>
      </form>
      )}
    </div>
  );
}
