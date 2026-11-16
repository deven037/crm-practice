import { FormEvent, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Building2, ChevronRight, KeyRound } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import { useAuth } from '../auth/AuthContext';
import { identify, PublicBank, rememberBank, rememberedBank } from '../data/frontDoor';
import { EMAIL_PATTERN } from './loginValidation';
import { BankMark, FrontDoorShell, Step } from './frontdoor/FrontDoorShell';
import { Field, Notice, PasswordField, SubmitButton } from './frontdoor/fields';

/**
 * Sign-in is email first. The person types their work email; the email's domain tells
 * the platform which bank they belong to, and the page becomes that bank's page before
 * it asks for the password.
 *
 *   email ──▶ (pick: the domain belongs to more than one bank) ──▶ password
 *   byName: for people whose email is not on their bank's domain
 *   forgot: how to get a new password
 */
type Stage = 'email' | 'pick' | 'password' | 'byName' | 'forgot';

const HELP_URL = import.meta.env.VITE_HELP_URL?.trim();
const PRIVACY_URL = import.meta.env.VITE_PRIVACY_URL?.trim();
const APP_VERSION = import.meta.env.VITE_APP_VERSION?.trim();
const APP_ENV = import.meta.env.VITE_APP_ENV?.trim();
const BUILD_LABEL = [APP_VERSION && `v${APP_VERSION}`, APP_ENV].filter(Boolean).join(' · ');

/** Sign-in failures that are about the bank, not about what was typed. */
const BANK_STATE_TITLES: Record<string, string> = {
  bank_pending: 'Waiting for approval',
  bank_rejected: 'Registration not approved',
  bank_suspended: 'Bank suspended',
  account_deactivated: 'Account deactivated',
};

export function emailProblem(email: string): string | undefined {
  if (!email.trim()) return 'Email is required.';
  if (!EMAIL_PATTERN.test(email.trim())) return 'Enter a valid email address.';
  return undefined;
}

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // A bank this device has signed in to before: its page opens directly.
  const [bank, setBank] = useState<PublicBank | null>(() => rememberedBank());
  const [stage, setStage] = useState<Stage>('email');
  const [back, setBack] = useState(false);
  const [choices, setChoices] = useState<PublicBank[]>([]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [bankName, setBankName] = useState('');
  const [remember, setRemember] = useState(true);
  const [errors, setErrors] = useState<{ email?: string; password?: string; bankName?: string }>({});
  const [notice, setNotice] = useState<{ title?: string; message: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const go = (next: Stage, goingBack = false) => {
    setBack(goingBack);
    setErrors({});
    setNotice(null);
    setStage(next);
  };

  /** "Not your bank?": forget the remembered bank and start again from the plain page. */
  const forgetBank = () => {
    rememberBank(null);
    setBank(null);
    setChoices([]);
    setPassword('');
    go('email', true);
  };

  const continueWithEmail = async (e: FormEvent) => {
    e.preventDefault();
    const problem = emailProblem(email);
    if (problem) {
      setErrors({ email: problem });
      return;
    }
    // The bank is already known on this device: go straight to the password.
    if (bank) {
      go('password');
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const banks = await identify(email.trim());
      if (banks.length > 1) {
        setChoices(banks);
        go('pick');
      } else {
        // No bank for this domain: the same password step on the plain page, so the
        // page never says which domains or people are known.
        setBank(banks[0] ?? null);
        go('password');
      }
    } catch (error) {
      setNotice({ message: (error as Error).message || 'Unable to continue right now. Please try again.' });
    } finally {
      setBusy(false);
    }
  };

  const signIn = async (e: FormEvent) => {
    e.preventDefault();
    const byName = stage === 'byName';
    const next: typeof errors = {};
    if (byName) next.email = emailProblem(email);
    if (byName && !bankName.trim()) next.bankName = 'Enter your bank\'s name.';
    if (!password) next.password = 'Password is required.';
    if (next.email || next.bankName || next.password) {
      setErrors(next);
      return;
    }
    setErrors({});
    setNotice(null);
    setBusy(true);
    try {
      const failure = await login(email.trim(), password, remember, byName ? { bankName: bankName.trim() } : bank ? { bankId: bank.id } : {});
      if (!failure) {
        const from = (location.state as { from?: string } | null)?.from ?? '/';
        navigate(from, { replace: true });
      } else if (failure.code === 'bank_required' && failure.banks?.length) {
        setChoices(failure.banks);
        go('pick');
      } else if (BANK_STATE_TITLES[failure.code]) {
        setNotice({ title: BANK_STATE_TITLES[failure.code], message: failure.message });
      } else if (failure.code === 'invalid_credentials') {
        setErrors({ password: byName ? 'The email, bank name or password is not correct.' : failure.message });
      } else {
        setNotice({ message: failure.message || 'Unable to sign in right now. Please try again.' });
      }
    } finally {
      setBusy(false);
    }
  };

  const footer = (
    <>
      {HELP_URL && <a href={HELP_URL}>Help</a>}
      {PRIVACY_URL && <a href={PRIVACY_URL}>Privacy</a>}
      <Link to="/platform">Platform owner</Link>
      {BUILD_LABEL && <span>{BUILD_LABEL}</span>}
    </>
  );

  return (
    <FrontDoorShell bank={stage === 'byName' || stage === 'pick' ? null : bank} testId="login-page" footer={footer}>
      <AnimatePresence mode="wait" initial={false}>
        {stage === 'email' && (
          <Step id="email" key="email" back={back}>
            <form onSubmit={continueWithEmail} noValidate>
              <h1>{bank ? 'Welcome back' : 'Sign in'}</h1>
              <p className="fd-sub">{bank ? `Sign in to ${bank.name}.` : 'Use your work email to continue.'}</p>
              {notice && <Notice testId="login-error" title={notice.title}>{notice.message}</Notice>}
              <Field
                label="Work email"
                type="email"
                testId="login-email"
                autoComplete="username"
                autoFocus
                placeholder="you@yourbank.com"
                value={email}
                onChange={setEmail}
                error={errors.email}
              />
              <SubmitButton busy={busy} busyLabel="Finding your bank…" testId="login-continue">
                Continue <ArrowRight size={17} aria-hidden="true" />
              </SubmitButton>
              {bank ? (
                <button type="button" className="fd-link fd-link-row" data-testid="login-not-my-bank" onClick={forgetBank}>
                  Not your bank?
                </button>
              ) : (
                <button type="button" className="fd-link fd-link-row" data-testid="login-by-name" onClick={() => go('byName')}>
                  My email is not on my bank's domain
                </button>
              )}
            </form>
            {!bank && (
              <div className="fd-cards">
                <Link to="/register" className="fd-card" data-testid="register-link">
                  <span className="fd-card-icon"><Building2 size={19} /></span>
                  <span>
                    <strong>Register your bank</strong>
                    <small>Set up your bank's own CRM in a few minutes.</small>
                  </span>
                  <ChevronRight size={17} aria-hidden="true" />
                </Link>
                <Link to="/register/status" className="fd-card fd-card-quiet" data-testid="status-link">
                  <span>
                    <strong>Already registered?</strong>
                    <small>Check whether your bank has been approved.</small>
                  </span>
                  <ChevronRight size={17} aria-hidden="true" />
                </Link>
              </div>
            )}
          </Step>
        )}

        {stage === 'pick' && (
          <Step id="pick" key="pick" back={back}>
            <h1>Choose your bank</h1>
            <p className="fd-sub">More than one bank uses this email domain.</p>
            <ul className="fd-banks" data-testid="login-bank-choices">
              {choices.map((choice) => (
                <li key={choice.id}>
                  <button
                    type="button"
                    className="fd-bank-option"
                    onClick={() => {
                      setBank(choice);
                      go('password');
                    }}
                  >
                    <BankMark bank={choice} size={40} />
                    <strong>{choice.name}</strong>
                    <ChevronRight size={17} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" className="fd-link fd-link-row" onClick={() => go('email', true)}>
              <ArrowLeft size={15} aria-hidden="true" /> Use a different email
            </button>
          </Step>
        )}

        {stage === 'password' && (
          <Step id="password" key="password" back={back}>
            <form onSubmit={signIn} noValidate>
              <h1>{bank ? `Sign in to ${bank.name}` : 'Enter your password'}</h1>
              <div className="fd-who">
                <span title={email}>{email}</span>
                <button type="button" className="fd-link" data-testid="login-change-email" onClick={() => { setPassword(''); go('email', true); }}>
                  Change
                </button>
              </div>
              {notice && <Notice testId="login-error" tone={notice.title ? 'warn' : 'error'} title={notice.title}>{notice.message}</Notice>}
              <PasswordField
                label="Password"
                testId="login-password"
                errorTestId="login-error"
                autoComplete="current-password"
                autoFocus
                placeholder="Enter your password"
                value={password}
                onChange={setPassword}
                error={errors.password}
              />
              <div className="fd-row">
                <label className="fd-chk">
                  <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Remember me
                </label>
                <button type="button" className="fd-link" onClick={() => go('forgot')}>
                  Forgot password?
                </button>
              </div>
              <SubmitButton busy={busy} busyLabel="Signing in…" testId="login-submit">Sign in</SubmitButton>
              {bank && (
                <button type="button" className="fd-link fd-link-row" data-testid="login-not-my-bank" onClick={forgetBank}>
                  Not your bank?
                </button>
              )}
            </form>
          </Step>
        )}

        {stage === 'byName' && (
          <Step id="byName" key="byName" back={back}>
            <form onSubmit={signIn} noValidate>
              <h1>Sign in with your bank's name</h1>
              <p className="fd-sub">For people whose email is not on their bank's own domain. Type the bank's name exactly as it appears in the CRM.</p>
              {notice && <Notice testId="login-error" tone={notice.title ? 'warn' : 'error'} title={notice.title}>{notice.message}</Notice>}
              <Field label="Bank name" testId="login-bank-name" autoFocus placeholder="Your bank's name" value={bankName} onChange={setBankName} error={errors.bankName} />
              <Field label="Email" type="email" testId="login-email" autoComplete="username" placeholder="you@example.com" value={email} onChange={setEmail} error={errors.email} />
              <PasswordField label="Password" testId="login-password" errorTestId="login-error" autoComplete="current-password" placeholder="Enter your password" value={password} onChange={setPassword} error={errors.password} />
              <SubmitButton busy={busy} busyLabel="Signing in…" testId="login-submit">Sign in</SubmitButton>
              <button type="button" className="fd-link fd-link-row" onClick={() => go('email', true)}>
                <ArrowLeft size={15} aria-hidden="true" /> Back to work email
              </button>
            </form>
          </Step>
        )}

        {stage === 'forgot' && (
          <Step id="forgot" key="forgot" back={back}>
            <span className="fd-badge-icon"><KeyRound size={22} /></span>
            <h1>Forgot your password?</h1>
            <p className="fd-sub">
              Ask {bank ? `an administrator at ${bank.name}` : 'your bank\'s CRM administrator'} for a new sign-in link. They can create one from Setup, Users.
              The link lets you choose a new password and works once.
            </p>
            <Notice tone="info" testId="reset-info">For your security, passwords are never sent by email and nobody at the bank can see yours.</Notice>
            <button type="button" className="fd-btn fd-btn-quiet" onClick={() => go(email ? 'password' : 'email', true)}>
              <ArrowLeft size={16} aria-hidden="true" /> Back to sign in
            </button>
          </Step>
        )}
      </AnimatePresence>
    </FrontDoorShell>
  );
}
