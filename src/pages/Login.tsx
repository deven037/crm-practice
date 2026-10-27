import { FormEvent, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { EMAIL_PATTERN, RESET_UNAVAILABLE_MESSAGE } from './loginValidation';

// Only the email-request step exists. The code and new-password steps were removed
// because no reset endpoint exists yet; add them back together with that endpoint.
type Mode = 'login' | 'forgot-email';

const BANK_NAME = import.meta.env.VITE_BANK_NAME?.trim() || 'Your bank';
const BANK_LOGO_URL = import.meta.env.VITE_BANK_LOGO_URL?.trim();

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
  const [busy, setBusy] = useState(false);

  const [resetEmail, setResetEmail] = useState('');

  const validate = () => {
    const errs: { email?: string; password?: string } = {};
    if (!email.trim()) errs.email = 'Email is required.';
    else if (!EMAIL_PATTERN.test(email.trim())) errs.email = 'Enter a valid email address.';
    if (!password) errs.password = 'Password is required.';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!validate()) return;
    setBusy(true);
    try {
      const err = await login(email, password, remember);
      if (err) {
        setError(err);
      } else {
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

  return (
    <div className="login-page" data-testid="login-page">
      <div className="login-card">
        <div className="brand login-brand">
          <span className="brand-logo">◆</span>
          <span className="brand-name">Harbor CRM</span>
        </div>
        <div className="login-bank-brand" aria-label={BANK_NAME}>
          {BANK_LOGO_URL && <img className="login-bank-logo" src={BANK_LOGO_URL} alt="" />}
          <span>{BANK_NAME}</span>
        </div>

        {mode === 'login' && (
          <form onSubmit={handleLogin} noValidate>
            <h2>Sign in</h2>
            {error && <div className="banner banner-error" data-testid="login-error" role="alert">{error}</div>}
            <label className="field">
              <span className="field-label">Email</span>
              <input
                type="email"
                className="input"
                data-testid="login-email"
                aria-invalid={Boolean(fieldErrors.email)}
                aria-describedby={fieldErrors.email ? 'login-email-error' : undefined}
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              {fieldErrors.email && <span id="login-email-error" className="field-error">{fieldErrors.email}</span>}
            </label>
            <label className="field">
              <span className="field-label">Password</span>
              <div className="password-wrap">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="input"
                  data-testid="login-password"
                  aria-invalid={Boolean(fieldErrors.password)}
                  aria-describedby={fieldErrors.password ? 'login-password-error' : undefined}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="password-toggle"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword((s) => !s)}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {fieldErrors.password && <span id="login-password-error" className="field-error">{fieldErrors.password}</span>}
            </label>
            <div className="login-row">
              <label className="checkbox-label">
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Remember me
              </label>
              <button type="button" className="link-btn" onClick={() => { setError(null); setMode('forgot-email'); }}>
                Forgot password?
              </button>
            </div>
            <button type="submit" className="btn btn-primary btn-block" data-testid="login-submit" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        )}

        {mode === 'forgot-email' && (
          <form onSubmit={handleForgotEmail} noValidate>
            <h2>Reset password</h2>
            <p className="muted">Enter your account email to request a password reset.</p>
            {error && <div className="banner banner-error" data-testid="reset-error" role="alert">{error}</div>}
            <label className="field">
              <span className="field-label">Email</span>
              <input type="email" className="input" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} />
            </label>
            <button type="submit" className="btn btn-primary btn-block">Request reset</button>
            <button type="button" className="link-btn btn-block" onClick={() => { setError(null); setMode('login'); }}>
              Back to sign in
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
