import { FormEvent, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { apiFetch, replaceToken } from '../data/apiFetch';
import { passwordProblem, rememberedBank } from '../data/frontDoor';
import { User } from '../types';
import { PageSkeleton } from '../components/v3';
import { FrontDoorShell } from './frontdoor/FrontDoorShell';
import { Notice, PasswordField, SubmitButton } from './frontdoor/fields';

/** Sends a password change. The server answers with a new token; every other device is signed out. */
export async function changePassword(currentPassword: string, newPassword: string): Promise<User> {
  const { token, user } = await apiFetch<{ token: string; user: User }>('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  replaceToken(token);
  return user;
}

/** What is wrong with a new password and its repeat, field by field. Empty when nothing is. */
export function newPasswordProblems(current: string, next: string, confirm: string): { current?: string; next?: string; confirm?: string } {
  const problems: { current?: string; next?: string; confirm?: string } = {};
  if (!current) problems.current = 'Enter your current password.';
  const rule = passwordProblem(next);
  if (rule) problems.next = rule;
  else if (next === current) problems.next = 'Choose a password you have not just used.';
  if (confirm !== next) problems.confirm = 'The two passwords do not match.';
  return problems;
}

/**
 * First sign-in with a password an administrator chose: the person must replace it
 * before they can use anything else.
 */
export function SetPassword() {
  const { user, refreshUser, logout } = useAuth();
  const navigate = useNavigate();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<ReturnType<typeof newPasswordProblems>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user === undefined) return <PageSkeleton label="Checking session…" />;
  if (!user) return <Navigate to="/login" replace />;
  if (!user.mustChangePassword && !busy) return <Navigate to="/" replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const problems = newPasswordProblems(current, next, confirm);
    setErrors(problems);
    if (Object.keys(problems).length) return;
    setBusy(true);
    setNotice(null);
    try {
      await changePassword(current, next);
      await refreshUser();
      navigate('/', { replace: true });
    } catch (error) {
      const failure = error as Error & { code?: string };
      if (failure.code === 'wrong_password') setErrors({ current: failure.message });
      else setNotice(failure.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <FrontDoorShell bank={rememberedBank()} testId="set-password-page">
      <form onSubmit={submit} noValidate>
        <span className="fd-badge-icon"><ShieldCheck size={22} /></span>
        <h1>Choose your own password</h1>
        <p className="fd-sub">Your administrator set a temporary password for you. Replace it to continue.</p>
        {notice && <Notice testId="set-password-error">{notice}</Notice>}
        <PasswordField label="Temporary password" testId="set-password-current" autoComplete="current-password" autoFocus value={current} onChange={setCurrent} error={errors.current} />
        <PasswordField label="New password" testId="set-password-new" autoComplete="new-password" rules value={next} onChange={setNext} error={errors.next} />
        <PasswordField label="Type it again" testId="set-password-confirm" autoComplete="new-password" value={confirm} onChange={setConfirm} error={errors.confirm} />
        <SubmitButton busy={busy} busyLabel="Saving…" testId="set-password-submit">Save and continue</SubmitButton>
        <button type="button" className="fd-link fd-link-row" onClick={() => { logout(); navigate('/login'); }}>
          Sign out
        </button>
      </form>
    </FrontDoorShell>
  );
}
