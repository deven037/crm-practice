import { CSSProperties, FormEvent, KeyboardEvent, ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, ImagePlus, Pencil, Save, Trash2, X } from 'lucide-react';
import { AnimatePresence, motion, MotionConfig } from 'motion/react';
import { ApiError, BANK_TYPES, fileToDataUrl, imageProblem, registerBank } from '../data/frontDoor';
import { SearchableSelect } from '../components/Select';
import { useToast } from '../components/Toast';
import { applyBankTheme, bankTheme } from '../theme/bankTheme';
import { ProductMark, PRODUCT_NAME } from './frontdoor/FrontDoorShell';
import { Field, FieldError, Notice, PasswordField } from './frontdoor/fields';
import {
  BRAND_PRESETS, clearDraft, cleanDomain, COUNTRY_CURRENCY, countryChoices, countryName, currencyChoices, domainProblem, Draft, emailDomain,
  emptyDraft, firstIncompleteStep, loadDraft, LOCALE_CHOICES, Problems, rememberSent, saveDraft, stepOfField, stepProblems, StepId, STEPS,
  timezoneChoices, toRegistration,
} from './register/registration';

/** A small copy of the sign-in page, drawn with the bank's own logo, picture and colour as they are chosen. */
export function LoginPreview({ name, color, logo, image }: { name: string; color: string; logo?: string | null; image?: string | null }) {
  const theme = bankTheme(color);
  const shown = name.trim() || 'Your bank';
  const style = { '--pv': theme.primary, '--pv-on': theme.on } as CSSProperties;
  return (
    <div className="rg-preview" style={style} aria-label="Preview of your bank's sign-in page" role="img" data-testid="login-preview">
      <div className="rg-preview-bar"><i /><i /><i /></div>
      <div className="rg-preview-body">
        <div className="rg-preview-form">
          <div className="rg-preview-brand">
            <span className={logo ? 'has-logo' : ''}>{logo ? <img src={logo} alt="" /> : shown.charAt(0).toUpperCase()}</span>
            <b>{shown}</b>
          </div>
          <strong>Sign in to {shown}</strong>
          <span className="rg-preview-input" />
          <span className="rg-preview-input" />
          <span className="rg-preview-btn">Sign in</span>
        </div>
        <div className="rg-preview-art">
          <AnimatePresence mode="popLayout">
            {image ? (
              <motion.img key={image.slice(-40)} src={image} alt="" initial={{ opacity: 0, scale: 1.08 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }} />
            ) : (
              <motion.em key="letter" initial={{ opacity: 0 }} animate={{ opacity: 0.2 }} exit={{ opacity: 0 }}>{shown.charAt(0).toUpperCase()}</motion.em>
            )}
          </AnimatePresence>
          <small>{shown}</small>
        </div>
      </div>
    </div>
  );
}

/** Choose, replace or remove one picture. Checks the type and size before it is accepted. */
export function ImagePicker({ kind, label, hint, value, onChange, testId }: {
  kind: 'logo' | 'login';
  label: string;
  hint: string;
  value: string | null;
  onChange: (dataUrl: string) => void;
  testId: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [over, setOver] = useState(false);

  const take = async (file: File | undefined) => {
    if (!file) return;
    const wrong = imageProblem(file, kind);
    setProblem(wrong);
    if (wrong) return;
    try {
      onChange(await fileToDataUrl(file));
    } catch (error) {
      setProblem((error as Error).message);
    }
  };

  return (
    <div className="fd-field">
      <span className="fd-label">{label}<em>Optional</em></span>
      <div
        className={`rg-drop rg-drop-${kind}${over ? ' is-over' : ''}${value ? ' has-image' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); take(e.dataTransfer.files[0]); }}
      >
        {value ? <img src={value} alt="" /> : <span className="rg-drop-icon"><ImagePlus size={20} /></span>}
        <div className="rg-drop-text">
          <button type="button" className="fd-link" onClick={() => input.current?.click()}>{value ? 'Replace' : 'Choose a file'}</button>
          {value ? (
            <button type="button" className="fd-link rg-remove" onClick={() => { onChange(''); setProblem(null); }}><Trash2 size={14} /> Remove</button>
          ) : (
            <span>or drop it here</span>
          )}
          <small>{hint}</small>
        </div>
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          aria-label={label}
          data-testid={testId}
          onChange={(e) => { take(e.target.files?.[0]); e.target.value = ''; }}
        />
      </div>
      {problem && <FieldError>{problem}</FieldError>}
    </div>
  );
}

export function ColorPicker({ value, onChange, error }: { value: string; onChange: (color: string) => void; error?: string }) {
  return (
    <div className={`fd-field${error ? ' has-error' : ''}`}>
      <span className="fd-label">Brand colour</span>
      <div className="rg-swatches" role="radiogroup" aria-label="Brand colour">
        {BRAND_PRESETS.map((color) => (
          <button
            key={color}
            type="button"
            role="radio"
            aria-checked={value.toLowerCase() === color}
            aria-label={color}
            className="rg-swatch"
            style={{ background: color }}
            onClick={() => onChange(color)}
          >
            {value.toLowerCase() === color && <Check size={15} strokeWidth={3} color={bankTheme(color).on} />}
          </button>
        ))}
        <label className="rg-swatch rg-swatch-custom" title="Pick any colour">
          <input type="color" value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#1d3a6e'} onChange={(e) => onChange(e.target.value)} aria-label="Pick any colour" />
        </label>
        <input className="fd-input rg-hex" value={value} onChange={(e) => onChange(e.target.value)} aria-label="Colour as a hex code" data-testid="register-color" maxLength={7} spellCheck={false} />
      </div>
      {error ? <FieldError>{error}</FieldError> : <span className="fd-hint">Buttons, highlights and your sign-in page use this colour. Text on it stays readable automatically.</span>}
    </div>
  );
}

/** The bank's email domains as removable chips. Enter, comma or space adds what was typed. */
function DomainInput({ values, onChange, error }: { values: string[]; onChange: (values: string[]) => void; error?: string }) {
  const [typed, setTyped] = useState('');
  const [problem, setProblem] = useState<string | null>(null);

  const add = () => {
    if (!typed.trim()) return true;
    const domain = cleanDomain(typed);
    const wrong = domainProblem(domain) ?? (values.length >= 5 ? 'Five email domains at most.' : null);
    setProblem(wrong);
    if (wrong) return false;
    if (!values.includes(domain)) onChange([...values, domain]);
    setTyped('');
    return true;
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
      e.preventDefault();
      add();
    } else if (e.key === 'Backspace' && !typed && values.length) {
      onChange(values.slice(0, -1));
    }
  };

  const shownError = problem ?? error;
  return (
    <div className={`fd-field${shownError ? ' has-error' : ''}`}>
      <label className="fd-label" htmlFor="rg-domain">Email domains for sign-in</label>
      <div className="rg-chips">
        <AnimatePresence initial={false}>
          {values.map((domain) => (
            <motion.span key={domain} layout className="rg-chip" initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.7 }}>
              @{domain}
              <button type="button" aria-label={`Remove ${domain}`} onClick={() => onChange(values.filter((d) => d !== domain))}><X size={13} /></button>
            </motion.span>
          ))}
        </AnimatePresence>
        <input
          id="rg-domain"
          data-testid="register-domain"
          value={typed}
          placeholder={values.length ? 'Add another' : 'yourbank.com'}
          onChange={(e) => { setTyped(e.target.value); setProblem(null); }}
          onKeyDown={onKey}
          onBlur={add}
          aria-invalid={Boolean(shownError)}
          spellCheck={false}
        />
      </div>
      {shownError ? <FieldError>{shownError}</FieldError> : <span className="fd-hint">Anyone with an email on these domains is taken to your bank's sign-in page. Public mail services are not accepted.</span>}
    </div>
  );
}

function Picker({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <div className={`fd-field${error ? ' has-error' : ''}`}>
      <span className="fd-label">{label}</span>
      {children}
      {error && <FieldError>{error}</FieldError>}
    </div>
  );
}

function ReviewBlock({ title, onEdit, children }: { title: string; onEdit: () => void; children: ReactNode }) {
  return (
    <section className="rg-review-block">
      <header>
        <h3>{title}</h3>
        <button type="button" className="fd-link" onClick={onEdit}><Pencil size={14} /> Edit</button>
      </header>
      <dl>{children}</dl>
    </section>
  );
}
const Row = ({ label, children }: { label: string; children: ReactNode }) => (
  <div><dt>{label}</dt><dd>{children || <span className="muted">Not given</span>}</dd></div>
);

export function Register() {
  const navigate = useNavigate();
  const toast = useToast();
  const saved = useMemo(() => loadDraft(), []);
  const [draft, setDraft] = useState<Draft>(() => saved?.draft ?? emptyDraft());
  const [step, setStep] = useState<StepId>(() => saved?.step ?? 'bank');
  const [resumed, setResumed] = useState(Boolean(saved));
  const [back, setBack] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [problems, setProblems] = useState<Problems>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const top = useRef<HTMLDivElement>(null);

  const countries = useMemo(countryChoices, []);
  const currencies = useMemo(currencyChoices, []);
  const timezones = useMemo(timezoneChoices, []);
  const index = STEPS.findIndex((s) => s.id === step);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setProblems((p) => (p[key] ? { ...p, [key]: undefined } : p));
  };

  // Everything typed is kept on this device as it is typed, so nothing is lost by closing the page.
  useEffect(() => {
    const timer = window.setTimeout(() => saveDraft(draft, step), 400);
    return () => window.clearTimeout(timer);
  }, [draft, step]);

  // The form itself takes the colour being chosen: the bank sees its own CRM taking shape.
  useEffect(() => {
    applyBankTheme(draft.brandColor, false);
  }, [draft.brandColor]);
  useEffect(() => () => void applyBankTheme(null, false), []);

  const goTo = (next: StepId) => {
    setBack(STEPS.findIndex((s) => s.id === next) < index);
    setNotice(null);
    setStep(next);
    top.current?.scrollIntoView({ block: 'start' });
  };

  const next = (e: FormEvent) => {
    e.preventDefault();
    const found = stepProblems(step, draft, password, confirm);
    setProblems(found);
    if (Object.keys(found).length) return;
    if (step === 'bank' && !draft.currency && COUNTRY_CURRENCY[draft.country]) set('currency', COUNTRY_CURRENCY[draft.country]);
    if (step === 'contact' && draft.emailDomains.length === 0 && !domainProblem(emailDomain(draft.contactEmail))) set('emailDomains', [emailDomain(draft.contactEmail)]);
    goTo(STEPS[index + 1].id);
  };

  const saveForLater = () => {
    const withImages = saveDraft(draft, step);
    toast.push('success', withImages ? 'Saved on this device. Come back any time to finish.' : 'Saved on this device, except the pictures: they are too large to keep and need choosing again.');
    navigate('/login');
  };

  const startOver = () => {
    clearDraft();
    setDraft(emptyDraft());
    setPassword('');
    setConfirm('');
    setProblems({});
    setResumed(false);
    goTo('bank');
  };

  const submit = async () => {
    const incomplete = firstIncompleteStep(draft, password, confirm);
    if (incomplete) {
      setProblems(stepProblems(incomplete, draft, password, confirm));
      goTo(incomplete);
      setNotice(incomplete === 'admin' && !password ? 'Enter the admin password again. For your security it is never saved with a draft.' : 'Some details still need attention.');
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      await registerBank(toRegistration(draft, password));
      rememberSent(draft.adminEmail.trim().toLowerCase());
      clearDraft();
      navigate('/register/status', { replace: true, state: { justSent: true } });
    } catch (error) {
      const failure = error as ApiError;
      const fields = failure.fields ?? {};
      const names = Object.keys(fields);
      if (failure.code === 'bank_name_taken') {
        setProblems({ displayName: failure.message });
        goTo('bank');
      } else if (names.length) {
        // The server found something the form did not: show it on the field it belongs to.
        const mapped: Problems = {};
        for (const name of names) {
          const key = name === 'admin' ? 'adminEmail' : (name as keyof Draft);
          mapped[key] = fields[name];
        }
        setProblems(mapped);
        goTo(stepOfField(names[0]));
        setNotice(names[0] === 'logo' || names[0] === 'loginImage' ? fields[names[0]] : 'Some details still need attention.');
      } else {
        setNotice(failure.message || 'The registration could not be sent. Please try again.');
      }
    } finally {
      setBusy(false);
    }
  };

  const typeLabel = BANK_TYPES.find((t) => t.value === draft.bankType)?.label;

  return (
    <MotionConfig reducedMotion="user">
      <div className="rg-shell" data-testid="register-page" ref={top}>
        <header className="rg-top">
          <Link to="/login" className="fd-home" aria-label={PRODUCT_NAME}><ProductMark /></Link>
          <div className="rg-top-actions">
            <button type="button" className="fd-link" data-testid="register-save-later" onClick={saveForLater}><Save size={15} /> Save and continue later</button>
            <Link to="/login" className="fd-link">Sign in</Link>
          </div>
        </header>

        <div className="rg-body">
          <nav className="rg-rail" aria-label="Registration steps">
            <h1>Register your bank</h1>
            <p>Five short steps. Your bank can use the CRM as soon as the registration is approved.</p>
            <ol>
              {STEPS.map((s, i) => {
                const state = i < index ? 'done' : i === index ? 'current' : 'todo';
                return (
                  <li key={s.id} className={`is-${state}`}>
                    <button type="button" disabled={i > index} aria-current={state === 'current' ? 'step' : undefined} onClick={() => goTo(s.id)}>
                      <span className="rg-step-dot">{state === 'done' ? <Check size={14} strokeWidth={3} /> : i + 1}</span>
                      <span><strong>{s.title}</strong><small>{s.blurb}</small></span>
                    </button>
                  </li>
                );
              })}
            </ol>
            <div className="rg-progress" role="progressbar" aria-valuemin={0} aria-valuemax={STEPS.length - 1} aria-valuenow={index} aria-label="Progress">
              <motion.i animate={{ width: `${(index / (STEPS.length - 1)) * 100}%` }} transition={{ type: 'spring', stiffness: 160, damping: 24 }} />
            </div>
          </nav>

          <main className={`rg-main${step === 'branding' ? ' is-wide' : ''}`}>
            {resumed && (
              <Notice tone="info" testId="register-resumed" title="Continuing where you left off">
                Your earlier answers were kept on this device.{' '}
                <button type="button" className="rg-inline-link" onClick={startOver}>Start over</button>
              </Notice>
            )}
            {notice && <Notice testId="register-error">{notice}</Notice>}

            <AnimatePresence mode="wait" initial={false}>
              <motion.form
                key={step}
                className="rg-card"
                noValidate
                onSubmit={step === 'review' ? (e) => { e.preventDefault(); submit(); } : next}
                initial={{ opacity: 0, x: back ? -36 : 36 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: back ? 36 : -36, transition: { duration: 0.14 } }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              >
                <p className="rg-count">Step {Math.min(index + 1, 5)} of 5</p>

                {step === 'bank' && (
                  <>
                    <h2>Tell us about the bank</h2>
                    <div className="rg-grid">
                      <Field label="Legal name" testId="register-legal-name" autoFocus placeholder="Axis Bank Limited" value={draft.legalName} onChange={(v) => set('legalName', v)} error={problems.legalName} />
                      <Field label="Name shown in the CRM" testId="register-display-name" placeholder="Axis Bank" maxLength={80} value={draft.displayName} onChange={(v) => set('displayName', v)} error={problems.displayName} hint="Short, as your staff know it." />
                    </div>
                    <Picker label="Type of bank" error={problems.bankType}>
                      <div className="rg-types" role="radiogroup" aria-label="Type of bank">
                        {BANK_TYPES.map((type) => (
                          <button key={type.value} type="button" role="radio" aria-checked={draft.bankType === type.value} className="rg-type" data-testid={`register-type-${type.value}`} onClick={() => set('bankType', type.value)}>
                            {draft.bankType === type.value && <motion.span layoutId="rg-type-pill" className="rg-type-pill" transition={{ type: 'spring', stiffness: 420, damping: 32 }} />}
                            <span>{type.label}</span>
                          </button>
                        ))}
                      </div>
                    </Picker>
                    <div className="rg-grid">
                      <Field label="Licence or registration number" testId="register-number" maxLength={60} value={draft.registrationNumber} onChange={(v) => set('registrationNumber', v)} error={problems.registrationNumber} />
                      <Picker label="Country" error={problems.country}>
                        <SearchableSelect value={draft.country} options={countries} onChange={(v) => set('country', v)} placeholder="Choose a country" testId="register-country" />
                      </Picker>
                    </div>
                  </>
                )}

                {step === 'contact' && (
                  <>
                    <h2>How do we reach the bank?</h2>
                    <label className={`fd-field${problems.address ? ' has-error' : ''}`}>
                      <span className="fd-label">Head office address</span>
                      <textarea data-testid="register-address" autoFocus rows={3} maxLength={400} value={draft.address} onChange={(e) => set('address', e.target.value)} aria-invalid={Boolean(problems.address)} />
                      {problems.address && <FieldError>{problems.address}</FieldError>}
                    </label>
                    <Field label="Website" optional type="url" testId="register-website" placeholder="https://www.yourbank.com" value={draft.website} onChange={(v) => set('website', v)} error={problems.website} />
                    <div className="rg-grid">
                      <Field label="Contact person" testId="register-contact-name" autoComplete="name" value={draft.contactName} onChange={(v) => set('contactName', v)} error={problems.contactName} />
                      <Field label="Phone" type="tel" testId="register-contact-phone" autoComplete="tel" placeholder="+91 22 1234 5678" value={draft.contactPhone} onChange={(v) => set('contactPhone', v)} error={problems.contactPhone} />
                    </div>
                    <Field label="Contact email" type="email" testId="register-contact-email" autoComplete="email" placeholder="you@yourbank.com" value={draft.contactEmail} onChange={(v) => set('contactEmail', v)} error={problems.contactEmail} />
                  </>
                )}

                {step === 'branding' && (
                  <>
                    <h2>Make it your bank's own</h2>
                    <div className="rg-brand">
                      <div>
                        <ImagePicker kind="logo" label="Logo" hint="PNG, JPEG or WebP, up to 1 MB. Square works best." value={draft.logo} onChange={(v) => set('logo', v)} testId="register-logo" />
                        <ImagePicker kind="login" label="Sign-in page picture" hint="Shown on the right of your sign-in page. Up to 3 MB." value={draft.loginImage} onChange={(v) => set('loginImage', v)} testId="register-login-image" />
                        <ColorPicker value={draft.brandColor} onChange={(v) => set('brandColor', v)} error={problems.brandColor} />
                      </div>
                      <div className="rg-brand-preview">
                        <span className="fd-label">Your sign-in page</span>
                        <LoginPreview name={draft.displayName} color={draft.brandColor} logo={draft.logo} image={draft.loginImage} />
                        <span className="fd-hint">Updates as you choose. You can change all of this later in the CRM.</span>
                      </div>
                    </div>
                  </>
                )}

                {step === 'setup' && (
                  <>
                    <h2>Sign-in and region</h2>
                    <DomainInput values={draft.emailDomains} onChange={(v) => set('emailDomains', v)} error={problems.emailDomains} />
                    <div className="rg-grid">
                      <Picker label="Currency" error={problems.currency}>
                        <SearchableSelect value={draft.currency} options={currencies} onChange={(v) => set('currency', v)} placeholder="Choose a currency" testId="register-currency" />
                      </Picker>
                      <Picker label="Language and region" error={problems.locale}>
                        <SearchableSelect value={draft.locale} options={LOCALE_CHOICES} onChange={(v) => set('locale', v)} placeholder="Choose" testId="register-locale" />
                      </Picker>
                    </div>
                    <Picker label="Timezone" error={problems.timezone}>
                      <SearchableSelect value={draft.timezone} options={timezones} onChange={(v) => set('timezone', v)} placeholder="Choose a timezone" testId="register-timezone" />
                    </Picker>
                    <div className="rg-grid">
                      <Field label="Number of branches" inputMode="numeric" testId="register-branches" value={draft.branches} onChange={(v) => set('branches', v)} error={problems.branches} />
                      <Field label="People who will use the CRM" inputMode="numeric" testId="register-users" value={draft.expectedUsers} onChange={(v) => set('expectedUsers', v)} error={problems.expectedUsers} />
                    </div>
                    <label className="rg-toggle">
                      <span className="switch">
                        <input type="checkbox" data-testid="register-sample-data" checked={draft.sampleData} onChange={(e) => set('sampleData', e.target.checked)} />
                        <span className="switch-slider" />
                      </span>
                      <span>
                        <strong>Start with sample data</strong>
                        <small>Example leads, customers and deals, so the CRM is not empty on day one. You can delete them later.</small>
                      </span>
                    </label>
                  </>
                )}

                {step === 'admin' && (
                  <>
                    <h2>Who will run the CRM?</h2>
                    <p className="rg-lead">This person signs in first, once the bank is approved, and adds everyone else.</p>
                    <Field label="Full name" testId="register-admin-name" autoFocus autoComplete="name" value={draft.adminName} onChange={(v) => set('adminName', v)} error={problems.adminName} />
                    <Field
                      label="Work email"
                      type="email"
                      testId="register-admin-email"
                      autoComplete="username"
                      placeholder={`you@${draft.emailDomains[0] ?? 'yourbank.com'}`}
                      value={draft.adminEmail}
                      onChange={(v) => set('adminEmail', v)}
                      error={problems.adminEmail}
                      hint={`Must be on ${draft.emailDomains.map((d) => `@${d}`).join(' or ') || 'one of the bank\'s email domains'}. You also use it to check the registration.`}
                    />
                    <PasswordField label="Password" testId="register-admin-password" autoComplete="new-password" rules value={password} onChange={(v) => { setPassword(v); setProblems((p) => ({ ...p, password: undefined })); }} error={problems.password} />
                    <PasswordField label="Type it again" testId="register-admin-confirm" autoComplete="new-password" value={confirm} onChange={(v) => { setConfirm(v); setProblems((p) => ({ ...p, confirm: undefined })); }} error={problems.confirm} />
                  </>
                )}

                {step === 'review' && (
                  <>
                    <h2>Check and submit</h2>
                    <p className="rg-lead">The platform owner reviews every registration. Nothing can be used until it is approved.</p>
                    <div className="rg-review" data-testid="register-review">
                      <ReviewBlock title="Bank details" onEdit={() => goTo('bank')}>
                        <Row label="Legal name">{draft.legalName}</Row>
                        <Row label="Name in the CRM">{draft.displayName}</Row>
                        <Row label="Type">{typeLabel}</Row>
                        <Row label="Licence or registration">{draft.registrationNumber}</Row>
                        <Row label="Country">{countryName(draft.country)}</Row>
                      </ReviewBlock>
                      <ReviewBlock title="Contact" onEdit={() => goTo('contact')}>
                        <Row label="Head office">{draft.address}</Row>
                        <Row label="Website">{draft.website}</Row>
                        <Row label="Contact person">{draft.contactName}</Row>
                        <Row label="Phone">{draft.contactPhone}</Row>
                        <Row label="Email">{draft.contactEmail}</Row>
                      </ReviewBlock>
                      <ReviewBlock title="Branding" onEdit={() => goTo('branding')}>
                        <Row label="Logo">{draft.logo ? <img className="rg-thumb" src={draft.logo} alt="Your logo" /> : ''}</Row>
                        <Row label="Sign-in picture">{draft.loginImage ? <img className="rg-thumb rg-thumb-wide" src={draft.loginImage} alt="Your sign-in picture" /> : ''}</Row>
                        <Row label="Colour"><span className="rg-colour"><i style={{ background: draft.brandColor }} />{draft.brandColor}</span></Row>
                      </ReviewBlock>
                      <ReviewBlock title="Setup" onEdit={() => goTo('setup')}>
                        <Row label="Email domains">{draft.emailDomains.map((d) => `@${d}`).join(', ')}</Row>
                        <Row label="Currency">{draft.currency}</Row>
                        <Row label="Language and region">{LOCALE_CHOICES.find((l) => l.value === draft.locale)?.label ?? draft.locale}</Row>
                        <Row label="Timezone">{draft.timezone.replace(/_/g, ' ')}</Row>
                        <Row label="Branches">{draft.branches}</Row>
                        <Row label="Expected users">{draft.expectedUsers}</Row>
                        <Row label="Sample data">{draft.sampleData ? 'Yes' : 'No, start empty'}</Row>
                      </ReviewBlock>
                      <ReviewBlock title="First admin" onEdit={() => goTo('admin')}>
                        <Row label="Name">{draft.adminName}</Row>
                        <Row label="Email">{draft.adminEmail}</Row>
                        <Row label="Password">{password ? 'Set' : ''}</Row>
                      </ReviewBlock>
                    </div>
                  </>
                )}

                <footer className="rg-actions">
                  {index > 0 ? (
                    <button type="button" className="fd-btn fd-btn-quiet fd-btn-inline" data-testid="register-back" onClick={() => goTo(STEPS[index - 1].id)}>
                      <ArrowLeft size={16} aria-hidden="true" /> Back
                    </button>
                  ) : <span />}
                  <button type="submit" className="fd-btn fd-btn-inline" data-testid={step === 'review' ? 'register-submit' : 'register-next'} disabled={busy} aria-busy={busy}>
                    {busy && <span className="fd-spin" aria-hidden="true" />}
                    <span>{step === 'review' ? (busy ? 'Sending…' : 'Submit for approval') : step === 'admin' ? 'Review' : 'Continue'}{step !== 'review' && <ArrowRight size={16} aria-hidden="true" />}</span>
                  </button>
                </footer>
              </motion.form>
            </AnimatePresence>
          </main>
        </div>
      </div>
    </MotionConfig>
  );
}
