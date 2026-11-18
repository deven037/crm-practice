import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ChevronLeft, ShieldCheck } from 'lucide-react';
import { apiFetch } from '../data/apiFetch';
import { getAllSync, setCached } from '../data/store';
import { QuoteSettings, User } from '../types';
import { useToast } from '../components/Toast';
import { useAuth } from '../auth/AuthContext';
import { SearchPicker } from './deals/dealBits';
import { UserFace } from './tickets/ticketBits';
import { money, quoteSettingsNow } from './quotes/quoteLogic';

/**
 * Setup → Quote settings: the tax quotes add, how long a quote stays valid, the discount above which a quote
 * needs approval, and who approves. Admins change them; everyone else sees them.
 */
export function QuoteSettingsPage() {
  const toast = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const saved = quoteSettingsNow();
  const people = getAllSync<User>('users').filter((u) => u.active !== false && (u.role === 'admin' || u.role === 'rep'));
  const [taxName, setTaxName] = useState(saved.taxName);
  const [taxPercent, setTaxPercent] = useState(String(saved.taxPercent));
  const [validityDays, setValidityDays] = useState(String(saved.validityDays));
  const [discountLimit, setDiscountLimit] = useState(String(saved.discountLimit));
  const [approverId, setApproverId] = useState(saved.approverId ?? '');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const num = (s: string) => Number(s.replace(',', '.'));
  const submit = async () => {
    const e: Record<string, string> = {};
    if (!taxName.trim()) e.taxName = 'Name the tax, for example GST.';
    if (!(num(taxPercent) >= 0 && num(taxPercent) <= 100)) e.taxPercent = 'Enter a percentage from 0 to 100.';
    if (!(Number.isInteger(num(validityDays)) && num(validityDays) >= 1 && num(validityDays) <= 365)) e.validityDays = 'Enter whole days from 1 to 365.';
    if (!(num(discountLimit) >= 0 && num(discountLimit) <= 100)) e.discountLimit = 'Enter a percentage from 0 to 100.';
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const fresh = await apiFetch<QuoteSettings>('/quoteSettings', {
        method: 'PUT',
        body: JSON.stringify({ taxName: taxName.trim(), taxPercent: num(taxPercent), validityDays: num(validityDays), discountLimit: num(discountLimit), approverId: approverId || null }),
      });
      // Every quote page reads the settings from the cache, so they use the new rules at once.
      setCached('quoteSettings', [fresh]);
      toast.push('success', 'Quote settings saved.');
    } catch (err) {
      toast.push('error', err instanceof Error && err.message ? err.message : 'The settings couldn’t be saved. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const approver = people.find((u) => u.id === approverId);
  const example = 100000;
  const field = (id: string, label: string, value: string, set: (v: string) => void, hint: string, suffix?: string) => (
    <div className="field">
      <label className="field-label" htmlFor={`qs-${id}`}>{label}</label>
      <div className="pq-suffix">
        <input id={`qs-${id}`} className="input" value={value} disabled={!isAdmin} inputMode="decimal" aria-invalid={errors[id] ? true : undefined} onChange={(e) => set(e.target.value)} data-testid={`quote-settings-${id}`} />
        {suffix && <span>{suffix}</span>}
      </div>
      {errors[id] ? <span className="field-error">{errors[id]}</span> : <span className="pq-hint">{hint}</span>}
    </div>
  );

  return (
    <div className="deal3 pq3 pq-form-page" data-testid="quote-settings-page">
      <Link to="/quotes" className="contact-back"><ChevronLeft size={16} aria-hidden="true" /> Quotes</Link>
      <div className="deal-fcols pq-fcols">
        <div className="card deal-formcard">
          <div className="acct-fhead">
            <h1>Quote settings</h1>
            <p>{isAdmin ? 'These rules apply to every quote of your bank.' : 'Only admins can change these rules.'}</p>
          </div>
          <div className="pq-sect">
            <h2>Tax and validity</h2>
            <div className="form-grid">
              <div className="field">
                <label className="field-label" htmlFor="qs-taxName">Tax name</label>
                <input id="qs-taxName" className="input" value={taxName} disabled={!isAdmin} onChange={(e) => setTaxName(e.target.value)} data-testid="quote-settings-taxName" />
                {errors.taxName ? <span className="field-error">{errors.taxName}</span> : <span className="pq-hint">Shown on every quote.</span>}
              </div>
              {field('taxPercent', 'Tax rate', taxPercent, setTaxPercent, 'Added on top of the prices.', '%')}
              {field('validityDays', 'Valid for', validityDays, setValidityDays, 'How long a new quote stays valid.', 'days')}
            </div>
          </div>
          <div className="pq-sect">
            <h2>Discount approval</h2>
            <div className="form-grid">
              {field('discountLimit', 'Approval needed above', discountLimit, setDiscountLimit, 'A line with a bigger discount can’t be sent until it is approved.', '%')}
              <div className="field">
                <span className="field-label">Approver</span>
                {isAdmin ? (
                  <SearchPicker label="Approver" find="Find a person" testId="quote-settings-approver" value={approverId}
                    options={[{ value: '', label: 'Any admin' }, ...people.map((u) => ({ value: u.id, label: u.name, hint: u.role, lead: <UserFace user={u} /> }))]}
                    onPick={setApproverId} />
                ) : <div className="pq-ro">{approver?.name ?? 'Any admin'}</div>}
                <span className="pq-hint">Admins can always approve as well.</span>
              </div>
            </div>
          </div>
          {isAdmin && (
            <div className="form-actions deal-savebar">
              <Link to="/quotes" className="btn">Cancel</Link>
              <button type="button" className="btn btn-primary contacts-primary" disabled={busy} onClick={submit} data-testid="save-quote-settings"><Check size={15} aria-hidden="true" /> {busy ? 'Saving…' : 'Save settings'}</button>
            </div>
          )}
        </div>
        <aside className="pq-prev" aria-label="Example">
          <span className="pq-lab">What it means</span>
          <div className="pq-card-box pq-box">
            <p className="pq-small">A {money(example)} line with a {num(discountLimit) + 5 || 20}% discount:</p>
            <p><ShieldCheck size={15} aria-hidden="true" /> needs {approver ? approver.name : 'an admin'} to approve, then the customer pays {money(example * (1 - (num(discountLimit) + 5) / 100) * (1 + (num(taxPercent) || 0) / 100))} with {taxName || 'tax'}.</p>
            <p className="pq-small pq-muted">New quotes are valid for {validityDays || '—'} days from the day they are made.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
