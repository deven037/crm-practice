import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { ApiError, BANK_TYPES, BankProfile, fetchOwnBank, OwnBank, rememberBank, removeBankImage, saveBankImage, saveOwnBank } from '../data/frontDoor';
import { SearchableSelect, Select } from '../components/Select';
import { useToast } from '../components/Toast';
import { PageSkeleton, SavedTick } from '../components/v3';
import { applyBankTheme } from '../theme/bankTheme';
import { ColorPicker, ImagePicker, LoginPreview } from './Register';
import {
  cleanDomain, countryChoices, currencyChoices, domainProblem, emailDomain, LOCALE_CHOICES, timezoneChoices,
} from './register/registration';
import { EMAIL_PATTERN } from './loginValidation';

type Form = Omit<BankProfile, 'branches' | 'expectedUsers'> & { branches: string; expectedUsers: string };
type Problems = Partial<Record<keyof Form, string>>;

function toForm(bank: OwnBank): Form {
  const p = bank.profile;
  return { ...p, displayName: bank.displayName, website: p.website ?? '', branches: String(p.branches), expectedUsers: String(p.expectedUsers) };
}

/** What has to be fixed before the bank's details can be saved. `ownEmail` guards against locking yourself out. */
export function settingsProblems(form: Form, ownEmail: string): Problems {
  const p: Problems = {};
  const need = (key: keyof Form, label: string) => {
    if (!String(form[key]).trim()) p[key] = `${label} is required.`;
  };
  need('displayName', 'Bank name');
  need('legalName', 'Legal name');
  need('registrationNumber', 'Licence or registration number');
  need('address', 'Head office address');
  need('contactName', 'Contact person');
  if (form.website.trim() && !/^https?:\/\/[^\s.]+\.[^\s]+$/i.test(form.website.trim())) p.website = 'Enter a full web address, starting with https://';
  if (!/^[+0-9 ()-]{6,24}$/.test(form.contactPhone.trim())) p.contactPhone = 'Enter a phone number.';
  if (!EMAIL_PATTERN.test(form.contactEmail.trim())) p.contactEmail = 'Enter a valid email address.';
  if (!/^#[0-9a-fA-F]{6}$/.test(form.brandColor.trim())) p.brandColor = 'Choose a colour.';
  if (form.emailDomains.length === 0) p.emailDomains = 'Add at least one email domain.';
  else if (form.emailDomains.length > 5) p.emailDomains = 'Five email domains at most.';
  else if (!form.emailDomains.includes(emailDomain(ownEmail))) p.emailDomains = `Keep @${emailDomain(ownEmail)}: it is the domain you sign in with.`;
  for (const key of ['branches', 'expectedUsers'] as const) {
    if (!/^\d+$/.test(form[key].trim()) || Number(form[key]) < 1) p[key] = 'Enter a whole number, 1 or more.';
  }
  return p;
}

function Text({ label, value, onChange, error, testId, disabled, type = 'text', span }: {
  label: string; value: string; onChange: (v: string) => void; error?: string; testId: string; disabled: boolean; type?: string; span?: boolean;
}) {
  return (
    <label className={`field${span ? ' field-span' : ''}`}>
      <span className="field-label">{label}</span>
      <input className="input" type={type} data-testid={testId} value={value} disabled={disabled} aria-invalid={Boolean(error)} onChange={(e) => onChange(e.target.value)} />
      {error && <span className="field-error" role="alert">{error}</span>}
    </label>
  );
}

/** The signed-in bank's own details and branding. Admins change them; everyone else may look. */
export function BankSettings() {
  const { user } = useAuth();
  const toast = useToast();
  const readOnly = user?.role !== 'admin';
  const [bank, setBank] = useState<OwnBank | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [problems, setProblems] = useState<Problems>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [typedDomain, setTypedDomain] = useState('');
  const [images, setImages] = useState<{ logo: string | null; login: string | null }>({ logo: null, login: null });

  const countries = useMemo(countryChoices, []);
  const currencies = useMemo(currencyChoices, []);
  const timezones = useMemo(timezoneChoices, []);

  useEffect(() => {
    fetchOwnBank().then(
      (found) => {
        setBank(found);
        setForm(toForm(found));
        setImages({ logo: found.logoUrl, login: found.loginImageUrl });
      },
      (error: Error) => setLoadError(error.message)
    );
  }, []);

  if (loadError) return <div className="banner banner-error" role="alert">{loadError}</div>;
  if (!bank || !form) return <PageSkeleton label="Loading your bank's settings" />;

  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((f) => (f ? { ...f, [key]: value } : f));
    setProblems((p) => (p[key] ? { ...p, [key]: undefined } : p));
    setSaved(false);
  };

  const addDomain = () => {
    const domain = cleanDomain(typedDomain);
    if (!domain) return;
    const wrong = domainProblem(domain);
    if (wrong) {
      setProblems((p) => ({ ...p, emailDomains: wrong }));
      return;
    }
    if (!form.emailDomains.includes(domain)) set('emailDomains', [...form.emailDomains, domain]);
    setTypedDomain('');
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const found = settingsProblems(form, user?.email ?? '');
    setProblems(found);
    if (Object.keys(found).length) {
      toast.push('error', 'Some details need attention before they can be saved.');
      return;
    }
    setSaving(true);
    try {
      const updated = await saveOwnBank({ ...form, website: form.website.trim(), brandColor: form.brandColor.toLowerCase(), branches: Number(form.branches), expectedUsers: Number(form.expectedUsers) });
      setBank(updated);
      setForm(toForm(updated));
      // The new colour and name take effect at once, here and on this device's sign-in page.
      applyBankTheme(updated.color);
      rememberBank({ id: updated.id, name: updated.name, status: updated.status, color: updated.color, logoUrl: updated.logoUrl, loginImageUrl: updated.loginImageUrl });
      setSaved(true);
      toast.push('success', 'Bank details saved.');
    } catch (error) {
      const failure = error as ApiError;
      if (failure.code === 'bank_name_taken') setProblems({ displayName: failure.message });
      else if (Object.keys(failure.fields ?? {}).length) setProblems(failure.fields as Problems);
      toast.push('error', failure.message);
    } finally {
      setSaving(false);
    }
  };

  /** Pictures are saved the moment they are chosen or removed. */
  const changeImage = async (kind: 'logo' | 'login', dataUrl: string) => {
    const before = images[kind];
    setImages((i) => ({ ...i, [kind]: dataUrl || null }));
    try {
      if (dataUrl) {
        const updated = await saveBankImage(kind, dataUrl);
        rememberBank(updated);
      } else {
        await removeBankImage(kind);
      }
      toast.push('success', `${kind === 'logo' ? 'Logo' : 'Sign-in picture'} ${dataUrl ? 'saved' : 'removed'}. It shows everywhere after the next page load.`);
    } catch (error) {
      setImages((i) => ({ ...i, [kind]: before }));
      toast.push('error', (error as Error).message);
    }
  };

  return (
    <form data-testid="bank-settings-page" className="bs-page" onSubmit={save} noValidate>
      <nav className="breadcrumbs">
        <Link to="/setup">Setup</Link> <span>/</span> <span>Bank profile</span>
      </nav>
      <div className="page-header">
        <div>
          <h1>Bank profile</h1>
          <p className="page-subtitle">How {bank.displayName} looks and is described across the CRM and on its sign-in page.</p>
        </div>
        <div className="page-actions">
          {saved && <span className="bs-saved"><SavedTick size={18} /> Saved</span>}
          <button type="submit" className="btn btn-primary" data-testid="bank-save-btn" disabled={readOnly || saving}>{saving ? 'Saving…' : 'Save changes'}</button>
        </div>
      </div>

      {readOnly && (
        <div className="banner banner-info" data-testid="admin-readonly-banner">
          Only an administrator can change the bank's profile. You can look, but not edit.
        </div>
      )}

      <section className="card">
        <h3>Branding</h3>
        <fieldset className="bs-brand" disabled={readOnly}>
          <div>
            <ImagePicker kind="logo" label="Logo" hint="PNG, JPEG or WebP, up to 1 MB. Square works best." value={images.logo} onChange={(v) => changeImage('logo', v)} testId="bank-logo" />
            <ImagePicker kind="login" label="Sign-in page picture" hint="Shown on the right of your sign-in page. Up to 3 MB." value={images.login} onChange={(v) => changeImage('login', v)} testId="bank-login-image" />
            <ColorPicker value={form.brandColor} onChange={(v) => set('brandColor', v)} error={problems.brandColor} />
          </div>
          <div className="rg-brand-preview">
            <span className="fd-label">Your sign-in page</span>
            <LoginPreview name={form.displayName} color={form.brandColor} logo={images.logo} image={images.login} />
            <span className="fd-hint">Pictures save as soon as you choose them. The colour and name save with the button above.</span>
          </div>
        </fieldset>
      </section>

      <section className="card">
        <h3>Bank details</h3>
        <div className="form-grid">
          <Text label="Name shown in the CRM" testId="bank-display-name" value={form.displayName} onChange={(v) => set('displayName', v)} error={problems.displayName} disabled={readOnly} />
          <Text label="Legal name" testId="bank-legal-name" value={form.legalName} onChange={(v) => set('legalName', v)} error={problems.legalName} disabled={readOnly} />
          <div className="field">
            <span className="field-label">Type of bank</span>
            <Select value={form.bankType} options={BANK_TYPES.map((t) => ({ value: t.value, label: t.label }))} onChange={(v) => set('bankType', v as Form['bankType'])} disabled={readOnly} testId="bank-type" />
          </div>
          <Text label="Licence or registration number" testId="bank-number" value={form.registrationNumber} onChange={(v) => set('registrationNumber', v)} error={problems.registrationNumber} disabled={readOnly} />
          <div className="field">
            <span className="field-label">Country</span>
            <SearchableSelect value={form.country} options={countries} onChange={(v) => set('country', v)} disabled={readOnly} testId="bank-country" />
          </div>
          <Text label="Website" type="url" testId="bank-website" value={form.website} onChange={(v) => set('website', v)} error={problems.website} disabled={readOnly} />
          <Text label="Head office address" testId="bank-address" value={form.address} onChange={(v) => set('address', v)} error={problems.address} disabled={readOnly} span />
        </div>
      </section>

      <section className="card">
        <h3>Contact</h3>
        <div className="form-grid">
          <Text label="Contact person" testId="bank-contact-name" value={form.contactName} onChange={(v) => set('contactName', v)} error={problems.contactName} disabled={readOnly} />
          <Text label="Phone" type="tel" testId="bank-contact-phone" value={form.contactPhone} onChange={(v) => set('contactPhone', v)} error={problems.contactPhone} disabled={readOnly} />
          <Text label="Contact email" type="email" testId="bank-contact-email" value={form.contactEmail} onChange={(v) => set('contactEmail', v)} error={problems.contactEmail} disabled={readOnly} />
        </div>
      </section>

      <section className="card">
        <h3>Sign-in and region</h3>
        <div className="field">
          <span className="field-label">Email domains for sign-in</span>
          <div className="chip-row bs-domains">
            {form.emailDomains.map((domain) => (
              <span key={domain} className="chip">
                @{domain}
                {!readOnly && (
                  <button type="button" className="bs-chip-x" aria-label={`Remove ${domain}`} onClick={() => set('emailDomains', form.emailDomains.filter((d) => d !== domain))}><X size={12} /></button>
                )}
              </span>
            ))}
            {!readOnly && (
              <>
                <input
                  className="input bs-domain-input"
                  placeholder="Add a domain"
                  aria-label="Add an email domain"
                  data-testid="bank-domain"
                  value={typedDomain}
                  onChange={(e) => setTypedDomain(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addDomain(); } }}
                />
                <button type="button" className="btn btn-small" onClick={addDomain}>Add</button>
              </>
            )}
          </div>
          {problems.emailDomains ? <span className="field-error" role="alert">{problems.emailDomains}</span> : <span className="muted">People with an email on these domains are taken to your bank's sign-in page.</span>}
        </div>
        <div className="form-grid">
          <div className="field">
            <span className="field-label">Currency</span>
            <SearchableSelect value={form.currency} options={currencies} onChange={(v) => set('currency', v)} disabled={readOnly} testId="bank-currency" />
          </div>
          <div className="field">
            <span className="field-label">Language and region</span>
            <SearchableSelect value={form.locale} options={LOCALE_CHOICES.some((l) => l.value === form.locale) ? LOCALE_CHOICES : [...LOCALE_CHOICES, { value: form.locale, label: form.locale }]} onChange={(v) => set('locale', v)} disabled={readOnly} testId="bank-locale" />
          </div>
          <div className="field">
            <span className="field-label">Timezone</span>
            <SearchableSelect value={form.timezone} options={timezones} onChange={(v) => set('timezone', v)} disabled={readOnly} testId="bank-timezone" />
          </div>
          <Text label="Number of branches" testId="bank-branches" value={form.branches} onChange={(v) => set('branches', v)} error={problems.branches} disabled={readOnly} />
          <Text label="People who use the CRM" testId="bank-users" value={form.expectedUsers} onChange={(v) => set('expectedUsers', v)} error={problems.expectedUsers} disabled={readOnly} />
        </div>
      </section>
    </form>
  );
}
