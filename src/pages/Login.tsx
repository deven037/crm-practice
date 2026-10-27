import { FormEvent, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { EMAIL_PATTERN, RESET_UNAVAILABLE_MESSAGE } from './loginValidation';

// Only the email-request step exists. The code and new-password steps were removed
// because no reset endpoint exists yet; add them back together with that endpoint.
type Mode = 'login' | 'forgot-email';

// Product and bank identity come from settings (design/DESIGN.md); the bank colour is --bank-primary.
const PRODUCT_NAME = import.meta.env.VITE_PRODUCT_NAME?.trim() || 'Harbor CRM';
const BANK_NAME = import.meta.env.VITE_BANK_NAME?.trim() || 'Your bank';
const BANK_LOGO_URL = import.meta.env.VITE_BANK_LOGO_URL?.trim();
const HELP_URL = import.meta.env.VITE_HELP_URL?.trim();
const PRIVACY_URL = import.meta.env.VITE_PRIVACY_URL?.trim();
const APP_VERSION = import.meta.env.VITE_APP_VERSION?.trim();
const APP_ENV = import.meta.env.VITE_APP_ENV?.trim();
const BUILD_LABEL = [APP_VERSION && `v${APP_VERSION}`, APP_ENV].filter(Boolean).join(' · ');

function BankMark() {
  return BANK_LOGO_URL ? (
    <img className="lg-bank-logo" src={BANK_LOGO_URL} alt="" />
  ) : (
    <b aria-hidden="true">{BANK_NAME.charAt(0).toUpperCase()}</b>
  );
}

const TIDES = [
  { opacity: 0.05, d: 'M0 120 C160 60 300 170 460 110 S720 60 800 100 V400 H0Z' },
  { opacity: 0.07, d: 'M0 200 C140 150 320 240 480 190 S700 150 800 190 V400 H0Z' },
  { opacity: 0.09, d: 'M0 280 C180 230 300 320 500 270 S700 240 800 275 V400 H0Z' },
  { opacity: 0.12, d: 'M0 345 C200 310 320 380 520 340 S720 320 800 345 V400 H0Z' },
];

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [touched, setTouched] = useState<{ email?: boolean; password?: boolean }>({});
  const [busy, setBusy] = useState(false);
  const [resetEmail, setResetEmail] = useState('');

  const check = (nextEmail: string, nextPassword: string) => {
    const errs: { email?: string; password?: string } = {};
    if (!nextEmail.trim()) errs.email = 'Email is required.';
    else if (!EMAIL_PATTERN.test(nextEmail.trim())) errs.email = 'Enter a valid email address.';
    if (!nextPassword) errs.password = 'Password is required.';
    return errs;
  };

  const validate = () => {
    const errs = check(email, password);
    setFieldErrors(errs);
    setTouched({ email: true, password: true });
    return Object.keys(errs).length === 0;
  };

  // Field errors show only after the field is touched or the form is submitted.
  const blurField = (field: 'email' | 'password') => {
    setTouched((t) => ({ ...t, [field]: true }));
    setFieldErrors((prev) => ({ ...prev, [field]: check(email, password)[field] }));
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!validate()) return;
    setBusy(true);
    try {
      const err = await login(email, password, remember);
      if (err) setError(err);
      else {
        const from = (location.state as { from?: string } | null)?.from ?? '/';
        navigate(from, { replace: true });
      }
    } catch {
      setError('Unable to sign in right now. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleForgotEmail = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!EMAIL_PATTERN.test(resetEmail.trim())) {
      setError('Enter a valid email address.');
      return;
    }
    // No email reset request endpoint exists yet. Do not claim a code was sent.
    setError(RESET_UNAVAILABLE_MESSAGE);
  };

  const emailError = touched.email ? fieldErrors.email : undefined;
  const passwordError = touched.password ? fieldErrors.password : undefined;

  return (
    <div className="lg-shell">
      <aside className="lg-brand" aria-label="Product">
        <div className="lg-mark">
          <i aria-hidden="true">◆</i>
          <span>{PRODUCT_NAME}</span>
        </div>
        <svg viewBox="0 0 800 400" preserveAspectRatio="none" aria-hidden="true">
          {TIDES.map((t) => <path key={t.d} opacity={t.opacity} d={t.d} />)}
        </svg>
        <div className="lg-pitch">
          <h2>Every customer, every deal, in one calm place.</h2>
          <p>Leads, contacts, quotes and tickets for your branch team, with nothing to set up before you start.</p>
        </div>
        <div className="lg-bankline" aria-label={BANK_NAME}>
          <BankMark />
          <span>{BANK_NAME}</span>
        </div>
      </aside>

      <main className="lg-side" data-testid="login-page">
        <div className="lg-panel">
          <div className="lg-mobile-mark">
            <i aria-hidden="true">◆</i>
            <span>{PRODUCT_NAME}</span>
            <small>{BANK_NAME}</small>
          </div>

          {mode === 'login' && (
            <form onSubmit={handleLogin} noValidate>
              <h1>Sign in</h1>
              <p className="lg-sub">Use your work email to continue.</p>
              <label className="lg-field">
                <span>Email</span>
                <input
                  type="email"
                  data-testid="login-email"
                  aria-invalid={Boolean(emailError)}
                  aria-describedby={emailError ? 'login-email-error' : undefined}
                  autoComplete="username"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => blurField('email')}
                />
                {emailError && <span id="login-email-error" className="lg-err" role="alert">{emailError}</span>}
              </label>
              <label className="lg-field">
                <span>Password</span>
                <div className="lg-ctl">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    data-testid="login-password"
                    aria-invalid={Boolean(passwordError)}
                    aria-describedby={passwordError ? 'login-password-error' : undefined}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onBlur={() => blurField('password')}
                  />
                  <button type="button" className="lg-eye" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((s) => !s)}>
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {passwordError && <span id="login-password-error" className="lg-err" role="alert">{passwordError}</span>}
              </label>
              <div className="lg-row">
                <label className="lg-chk">
                  <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Remember me
                </label>
                <button type="button" className="lg-link" onClick={() => { setError(null); setMode('forgot-email'); }}>
                  Forgot password?
                </button>
              </div>
              {error && (
                <div className="lg-banner" data-testid="login-error" role="alert">
                  <AlertCircle size={16} aria-hidden="true" />
                  <span>{error}</span>
                </div>
              )}
              <button type="submit" className="lg-btn" data-testid="login-submit" disabled={busy} aria-busy={busy}>
                {busy && <span className="lg-spin" aria-hidden="true" />}
                {busy ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
          )}

          {mode === 'forgot-email' && (
            <form onSubmit={handleForgotEmail} noValidate>
              <h1>Reset password</h1>
              <p className="lg-sub">Enter your account email to request a reset.</p>
              {error && (
                <div className="lg-banner" data-testid="reset-error" role="alert">
                  <AlertCircle size={16} aria-hidden="true" />
                  <span>{error}</span>
                </div>
              )}
              <label className="lg-field">
                <span>Email</span>
                <input type="email" autoComplete="username" placeholder="you@company.com" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} />
              </label>
              <button type="submit" className="lg-btn">Request reset</button>
              <button type="button" className="lg-btn lg-btn-quiet" onClick={() => { setError(null); setMode('login'); }}>
                Back to sign in
              </button>
            </form>
          )}
        </div>

        <div className="lg-foot">
          {HELP_URL && <a href={HELP_URL}>Help</a>}
          {PRIVACY_URL && <a href={PRIVACY_URL}>Privacy</a>}
          {BUILD_LABEL && <span>{BUILD_LABEL}</span>}
        </div>
      </main>
    </div>
  );
}
