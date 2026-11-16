import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { apiFetch } from '../../data/apiFetch';
import { Modal } from '../../components/Modal';
import { useToast } from '../../components/Toast';
import { changePassword, newPasswordProblems } from '../SetPassword';

/** Settings, "Password and sessions": change your own password, or sign out on every device. */
export function SecurityCard() {
  const toast = useToast();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<ReturnType<typeof newPasswordProblems>>({});
  const [busy, setBusy] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const problems = newPasswordProblems(current, next, confirm);
    setErrors(problems);
    if (Object.keys(problems).length) return;
    setBusy(true);
    try {
      await changePassword(current, next);
      setCurrent('');
      setNext('');
      setConfirm('');
      toast.push('success', 'Password changed. Your other devices have been signed out.');
    } catch (error) {
      const failure = error as Error & { code?: string };
      if (failure.code === 'wrong_password') setErrors({ current: failure.message });
      else toast.push('error', failure.message);
    } finally {
      setBusy(false);
    }
  };

  const signOutEverywhere = async () => {
    try {
      await apiFetch('/auth/logout-all', { method: 'POST' });
      logout();
      navigate('/login');
    } catch (error) {
      toast.push('error', (error as Error).message);
    }
  };

  const field = (label: string, value: string, onChange: (v: string) => void, testId: string, autoComplete: string, error?: string) => (
    <label className="field">
      <span className="field-label">{label}</span>
      <input className="input" type="password" data-testid={testId} autoComplete={autoComplete} value={value} aria-invalid={Boolean(error)} onChange={(e) => onChange(e.target.value)} />
      {error && <span className="field-error" role="alert">{error}</span>}
    </label>
  );

  return (
    <section className="card" data-testid="security-settings">
      <h3>Password and sessions</h3>
      <form onSubmit={save} noValidate>
        <div className="form-grid">
          {field('Current password', current, setCurrent, 'password-current', 'current-password', errors.current)}
          <span />
          {field('New password', next, setNext, 'password-new', 'new-password', errors.next)}
          {field('Type it again', confirm, setConfirm, 'password-confirm', 'new-password', errors.confirm)}
        </div>
        <p className="muted" style={{ marginTop: 0 }}>At least 8 characters, with a letter and a number. Changing it signs out your other devices.</p>
        <div className="page-actions">
          <button type="submit" className="btn btn-primary" data-testid="password-save-btn" disabled={busy}>{busy ? 'Saving…' : 'Change password'}</button>
          <button type="button" className="btn" data-testid="logout-all-btn" onClick={() => setConfirmSignOut(true)}><LogOut size={15} /> Sign out everywhere</button>
        </div>
      </form>

      {confirmSignOut && (
        <Modal
          title="Sign out everywhere?"
          onClose={() => setConfirmSignOut(false)}
          footer={
            <>
              <button className="btn" onClick={() => setConfirmSignOut(false)}>Cancel</button>
              <button className="btn btn-danger" data-testid="logout-all-confirm" onClick={signOutEverywhere}>Sign out everywhere</button>
            </>
          }
        >
          <p>Every device signed in as you, including this one, is signed out at once. You can sign in again straight away.</p>
        </Modal>
      )}
    </section>
  );
}
