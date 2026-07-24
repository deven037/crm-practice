import { FormEvent, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useToast } from '../components/Toast';
import { apiFetch } from '../data/apiFetch';

type Mode = 'login' | 'forgot-email' | 'forgot-code' | 'forgot-password';

// Cosmetic pacing only, for the forgot-password flow's fake email/code steps (no
// server round-trip backs those two — the real network call for the password
// change itself already provides realistic latency).
const delay = (min: number, max: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, min + Math.random() * (max - min)));

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [busy, setBusy] = useState(false);

  // forgot-password flow state
  const [resetEmail, setResetEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const validate = () => {
    const errs: { email?: string; password?: string } = {};
    if (!email.trim()) errs.email = 'Email is required.';
    else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) errs.email = 'Enter a valid email address.';
    if (!password) errs.password = 'Password is required.';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!validate()) return;
    setBusy(true);
    const err = await login(email, password, remember);
    setBusy(false);
    if (err) {
      setError(err);
    } else {
      const from = (location.state as { from?: string } | null)?.from ?? '/';
      navigate(from, { replace: true });
    }
  };

  const handleForgotEmail = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(resetEmail.trim())) {
      setError('Enter a valid email address.');
      return;
    }
    setBusy(true);
    await delay(500, 1200);
    setBusy(false);
    toast.push('info', `A reset code was "sent" to ${resetEmail} (hint: it is 123456)`);
    setMode('forgot-code');
  };

  const handleForgotCode = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    await delay(300, 700);
    setBusy(false);
    if (code.trim() !== '123456') {
      setError('Incorrect code. Try again.');
      return;
    }
    setMode('forgot-password');
  };

  const handleForgotPassword = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setBusy(true);
    await apiFetch('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email: resetEmail, newPassword }),
    });
    setBusy(false);
    toast.push('success', 'Password updated. You can sign in now.');
    setMode('login');
    setEmail(resetEmail);
    setPassword('');
    setCode('');
    setNewPassword('');
  };

  return (
    <div className="login-page" data-testid="login-page">
      <div className="login-card">
        <div className="brand login-brand">
          <span className="brand-logo">◆</span>
          <span className="brand-name">Practice CRM</span>
        </div>

        {mode === 'login' && (
          <form onSubmit={handleLogin} noValidate>
            <h2>Sign in</h2>
            {error && (
              <div className="banner banner-error" data-testid="login-error" role="alert">
                {error}
              </div>
            )}
            <label className="field">
              <span className="field-label">Email</span>
              <input
                type="email"
                className="input"
                data-testid="login-email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              {fieldErrors.email && <span className="field-error">{fieldErrors.email}</span>}
            </label>
            <label className="field">
              <span className="field-label">Password</span>
              <div className="password-wrap">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="input"
                  data-testid="login-password"
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
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
              {fieldErrors.password && <span className="field-error">{fieldErrors.password}</span>}
            </label>
            <div className="login-row">
              <label className="checkbox-label">
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Remember me
              </label>
              <button type="button" className="link-btn" onClick={() => setMode('forgot-email')}>
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
            <p className="muted">Step 1 of 3 — enter your account email.</p>
            {error && <div className="banner banner-error" role="alert">{error}</div>}
            <label className="field">
              <span className="field-label">Email</span>
              <input type="email" className="input" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} />
            </label>
            <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
              {busy ? 'Sending…' : 'Send reset code'}
            </button>
            <button type="button" className="link-btn btn-block" onClick={() => setMode('login')}>
              Back to sign in
            </button>
          </form>
        )}

        {mode === 'forgot-code' && (
          <form onSubmit={handleForgotCode} noValidate>
            <h2>Enter code</h2>
            <p className="muted">Step 2 of 3 — enter the 6-digit code we sent.</p>
            {error && <div className="banner banner-error" role="alert">{error}</div>}
            <label className="field">
              <span className="field-label">Reset code</span>
              <input className="input" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} />
            </label>
            <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
              {busy ? 'Verifying…' : 'Verify code'}
            </button>
            <button type="button" className="link-btn btn-block" onClick={() => setMode('login')}>
              Back to sign in
            </button>
          </form>
        )}

        {mode === 'forgot-password' && (
          <form onSubmit={handleForgotPassword} noValidate>
            <h2>New password</h2>
            <p className="muted">Step 3 of 3 — choose a new password.</p>
            {error && <div className="banner banner-error" role="alert">{error}</div>}
            <label className="field">
              <span className="field-label">New password</span>
              <input
                type="password"
                className="input"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </label>
            <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
              {busy ? 'Saving…' : 'Save password'}
            </button>
          </form>
        )}
      </div>

      <div className="login-hints">
        <strong>Demo credentials</strong> (password for all: <code>Pass@123</code>)
        <ul>
          <li><code>admin@crm.com</code> — full access</li>
          <li><code>rep@crm.com</code> — sales rep (read-only admin)</li>
          <li><code>viewer@crm.com</code> — viewer (no admin)</li>
        </ul>
      </div>
    </div>
  );
}
