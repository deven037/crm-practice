import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getAllSync, newId, upsert } from '../data/store';
import { Account, Contact } from '../types';
import { MultiSelect, SearchableSelect } from '../components/Select';
import { CustomFieldsSection, validateCustomFields } from '../components/CustomFieldsSection';
import { useToast } from '../components/Toast';
import { useAuth } from '../auth/AuthContext';

const TAG_OPTIONS = ['vip', 'newsletter', 'partner', 'decision-maker', 'follow-up', 'imported'].map((t) => ({
  value: t,
  label: t,
}));

export function ContactForm() {
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const accounts = getAllSync<Account>('accounts');

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
    createdAt: new Date().toISOString(),
  });
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});
  const [customErrors, setCustomErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const errs: typeof errors = {};
    if (!draft.name.trim()) errs.name = 'Name is required.';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(draft.email.trim())) errs.email = 'Enter a valid email.';
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

      <div className="card form-card">
        <div className="form-grid">
          <div className="field">
            <span className="field-label">Full name *</span>
            <input className="input" data-testid="contact-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            {errors.name && <span className="field-error">{errors.name}</span>}
          </div>
          <div className="field">
            <span className="field-label">Email *</span>
            <input className="input" data-testid="contact-email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
            {errors.email && <span className="field-error">{errors.email}</span>}
          </div>
          <div className="field">
            <span className="field-label">Phone</span>
            <input className="input" data-testid="contact-phone" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
          </div>
          <div className="field">
            <span className="field-label">Job title</span>
            <input className="input" data-testid="contact-title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          </div>
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
