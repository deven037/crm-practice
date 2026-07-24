import { useState } from 'react';
import { getValue, setValue } from '../data/store';
import { apiFetch, clearToken } from '../data/apiFetch';
import { Modal } from '../components/Modal';
import { Accordion } from '../components/Accordion';
import { useToast } from '../components/Toast';
import { useAuth } from '../auth/AuthContext';

interface Prefs {
  emailNotifs: boolean;
  pushNotifs: boolean;
  weeklyDigest: boolean;
  density: 'comfortable' | 'compact';
}

const DEFAULT_PREFS: Prefs = { emailNotifs: true, pushNotifs: false, weeklyDigest: true, density: 'comfortable' };

export function Settings() {
  const toast = useToast();
  const { user, refreshUser } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [errors, setErrors] = useState<{ name?: string; email?: string; phone?: string }>({});
  const [prefs, setPrefs] = useState<Prefs>(() => getValue('prefs', DEFAULT_PREFS));
  const [confirmReset, setConfirmReset] = useState(false);

  const saveProfile = async () => {
    const errs: typeof errors = {};
    if (!name.trim()) errs.name = 'Name is required.';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) errs.email = 'Enter a valid email address.';
    if (phone && !/^[+\d][\d\s-]{6,}$/.test(phone.trim())) errs.phone = 'Enter a valid phone number.';
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    if (user) {
      await apiFetch(`/users/${user.id}`, {
        method: 'PUT',
        body: JSON.stringify({ name: name.trim(), email: email.trim(), phone: phone.trim() }),
      });
      await refreshUser();
    }
    toast.push('success', 'Profile saved.');
  };

  const savePrefs = (next: Prefs) => {
    setPrefs(next);
    setValue('prefs', next);
  };

  const doReset = async () => {
    await apiFetch('/reset', { method: 'POST' });
    clearToken();
    toast.push('success', 'All data reset to seed state. Reloading…');
    setTimeout(() => {
      window.location.href = '/login';
    }, 800);
  };

  return (
    <div data-testid="settings-page">
      <div className="page-header">
        <h1>Settings</h1>
      </div>

      <section className="card">
        <h3>Profile</h3>
        <div className="form-grid">
          <div className="field">
            <span className="field-label">Full name *</span>
            <input className="input" data-testid="profile-name" value={name} onChange={(e) => setName(e.target.value)} />
            {errors.name && <span className="field-error">{errors.name}</span>}
          </div>
          <div className="field">
            <span className="field-label">Email *</span>
            <input className="input" data-testid="profile-email" value={email} onChange={(e) => setEmail(e.target.value)} />
            {errors.email && <span className="field-error">{errors.email}</span>}
          </div>
          <div className="field">
            <span className="field-label">Phone</span>
            <input className="input" data-testid="profile-phone" placeholder="+91 98xxx xxxxx" value={phone} onChange={(e) => setPhone(e.target.value)} />
            {errors.phone && <span className="field-error">{errors.phone}</span>}
          </div>
        </div>
        <button className="btn btn-primary" data-testid="profile-save-btn" onClick={saveProfile}>
          Save profile
        </button>
      </section>

      <section className="card">
        <h3>Notification preferences</h3>
        <label className="switch-row">
          <label className="switch">
            <input
              type="checkbox"
              checked={prefs.emailNotifs}
              onChange={(e) => savePrefs({ ...prefs, emailNotifs: e.target.checked })}
            />
            <span className="switch-slider" />
          </label>
          Email notifications
        </label>
        <label className="switch-row">
          <label className="switch">
            <input
              type="checkbox"
              checked={prefs.pushNotifs}
              onChange={(e) => savePrefs({ ...prefs, pushNotifs: e.target.checked })}
            />
            <span className="switch-slider" />
          </label>
          Push notifications
        </label>
        <label className="switch-row">
          <label className="switch">
            <input
              type="checkbox"
              checked={prefs.weeklyDigest}
              onChange={(e) => savePrefs({ ...prefs, weeklyDigest: e.target.checked })}
            />
            <span className="switch-slider" />
          </label>
          Weekly digest email
        </label>

        <h4>Display density</h4>
        <div className="radio-row">
          <label className="checkbox-label">
            <input
              type="radio"
              name="density"
              checked={prefs.density === 'comfortable'}
              onChange={() => savePrefs({ ...prefs, density: 'comfortable' })}
            />
            Comfortable
          </label>
          <label className="checkbox-label">
            <input
              type="radio"
              name="density"
              checked={prefs.density === 'compact'}
              onChange={() => savePrefs({ ...prefs, density: 'compact' })}
            />
            Compact
          </label>
        </div>
      </section>

      <section className="card">
        <h3>Help center</h3>
        <Accordion title="Open embedded help center (iframe)">
          {/* iframe — practices frame switching */}
          <iframe src="/help.html" title="Help Center" className="help-iframe" data-testid="help-iframe" />
        </Accordion>
      </section>

      <section className="card danger-zone">
        <h3>Danger zone</h3>
        <p className="muted">
          Reset all CRM data back to the original seed state. Use this to get a clean, repeatable dataset before test runs.
          You can also open the app with <code>?reset=true</code> to do this automatically.
        </p>
        <button className="btn btn-danger" data-testid="reset-data-btn" onClick={() => setConfirmReset(true)}>
          Reset all data
        </button>
      </section>

      {confirmReset && (
        <Modal
          title="Reset all data?"
          onClose={() => setConfirmReset(false)}
          footer={
            <>
              <button className="btn" onClick={() => setConfirmReset(false)}>
                Cancel
              </button>
              <button className="btn btn-danger" data-testid="reset-confirm-btn" onClick={doReset}>
                Yes, reset everything
              </button>
            </>
          }
        >
          <p>
            This wipes every change you've made (leads, deals, tickets, users…) and restores the deterministic seed data.
            You will be signed out.
          </p>
        </Modal>
      )}
    </div>
  );
}
