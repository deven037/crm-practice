import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, LinkIcon } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { apiFetch } from '../data/apiFetch';
import { Invite, passwordProblem, PublicBank, readInvite } from '../data/frontDoor';
import { User } from '../types';
import { FrontDoorShell } from './frontdoor/FrontDoorShell';
import { Notice, PasswordField, SubmitButton } from './frontdoor/fields';

/**
 * Where an invite link lands. The person sees who the link is for and which bank it
 * belongs to, chooses their own password, and is signed in. The link works once.
 */
export function AcceptInvite() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const navigate = useNavigate();
  const { startSession } = useAuth();

  const [invite, setInvite] = useState<Invite | null>(null);
  const [invalid, setInvalid] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let current = true;
    readInvite(token).then(
      (found) => current && setInvite(found),
      (error: Error) => current && setInvalid(error.message)
    );
    return () => {
      current = false;
    };
  }, [token]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const next = {
      password: passwordProblem(password) ?? undefined,
      confirm: confirm !== password ? 'The two passwords do not match.' : undefined,
    };
    setErrors(next);
    if (next.password || next.confirm) return;
    setBusy(true);
    setNotice(null);
    try {
      const session = await apiFetch<{ token: string; user: User; bank: PublicBank }>('/auth/accept-invite', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      });
      await startSession(session, true);
      navigate('/', { replace: true });
    } catch (error) {
      setNotice((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <FrontDoorShell bank={invite?.bank ?? null} testId="invite-page">
      {invalid ? (
        <div data-testid="invite-invalid">
          <span className="fd-badge-icon"><LinkIcon size={22} /></span>
          <h1>This link has expired</h1>
          <p className="fd-sub">{invalid}</p>
          <Link to="/login" className="fd-btn fd-btn-quiet"><ArrowLeft size={16} aria-hidden="true" /> Go to sign in</Link>
        </div>
      ) : !invite ? (
        <div role="status" aria-label="Checking your link">
          <div className="skeleton" style={{ height: 36, width: '70%', marginBottom: 14 }} />
          <div className="skeleton" style={{ height: 18, width: '90%', marginBottom: 30 }} />
          <div className="skeleton" style={{ height: 48, marginBottom: 18 }} />
          <div className="skeleton" style={{ height: 48 }} />
        </div>
      ) : (
        <form onSubmit={submit} noValidate>
          <h1>Welcome, {invite.name.split(' ')[0]}</h1>
          <p className="fd-sub">Choose a password for your {invite.bank.name} account.</p>
          <div className="fd-who"><span title={invite.email}>{invite.email}</span></div>
          {notice && <Notice testId="invite-error">{notice}</Notice>}
          <PasswordField label="New password" testId="invite-password" autoComplete="new-password" autoFocus rules value={password} onChange={setPassword} error={errors.password} />
          <PasswordField label="Type it again" testId="invite-confirm" autoComplete="new-password" value={confirm} onChange={setConfirm} error={errors.confirm} />
          <SubmitButton busy={busy} busyLabel="Setting up your account…" testId="invite-submit">Set password and sign in</SubmitButton>
        </form>
      )}
    </FrontDoorShell>
  );
}
