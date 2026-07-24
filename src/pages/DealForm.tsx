import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getAllSync, newId, upsert } from '../data/store';
import { Account, Deal, DealStage, DEAL_STAGES, User } from '../types';
import { SearchableSelect, Select } from '../components/Select';
import { DatePicker } from '../components/DatePicker';
import { CustomFieldsSection, validateCustomFields } from '../components/CustomFieldsSection';
import { useToast } from '../components/Toast';
import { useAuth } from '../auth/AuthContext';

export function DealForm() {
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();

  const accounts = getAllSync<Account>('accounts');
  const users = getAllSync<User>('users');

  const [draft, setDraft] = useState<Deal>({
    id: newId('deal'),
    name: '',
    accountId: null,
    amount: 0,
    stage: 'Qualification',
    closeDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    probability: 50,
    ownerId: user?.id ?? 'user-2',
    createdAt: new Date().toISOString(),
  });
  const [amountText, setAmountText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [customErrors, setCustomErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const commitAmount = () => {
    const parsed = Number(amountText.replace(/[^0-9.]/g, ''));
    const amount = Number.isFinite(parsed) ? Math.round(parsed) : 0;
    setDraft((d) => ({ ...d, amount }));
    setAmountText(amount ? amount.toLocaleString('en-US') : '');
  };

  const submit = async () => {
    if (!draft.name.trim()) {
      setError('Deal name is required.');
      return;
    }
    const cErrs = validateCustomFields('deals', 'form', draft.customFields ?? {});
    setCustomErrors(cErrs);
    if (Object.keys(cErrs).length > 0) return;
    setBusy(true);
    await upsert('deals', draft);
    toast.push('success', `Deal "${draft.name}" created.`);
    navigate(`/deals/${draft.id}`);
  };

  return (
    <div data-testid="deal-form-page">
      <nav className="breadcrumbs">
        <Link to="/deals">Deals</Link> <span>/</span> <span>New deal</span>
      </nav>
      <div className="page-header">
        <h1>New deal</h1>
      </div>

      <div className="card form-card">
        {error && <div className="banner banner-error" role="alert">{error}</div>}
        <div className="form-grid">
          <div className="field">
            <span className="field-label">Deal name *</span>
            <input className="input" data-testid="deal-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </div>
          <div className="field">
            <span className="field-label">Account</span>
            <SearchableSelect
              value={draft.accountId ?? ''}
              options={accounts.map((a) => ({ value: a.id, label: a.name }))}
              onChange={(v) => setDraft({ ...draft, accountId: v })}
              placeholder="Search accounts…"
              testId="deal-account"
            />
          </div>
          <div className="field">
            <span className="field-label">Amount</span>
            <input
              className="input"
              data-testid="deal-amount"
              placeholder="e.g. 25,000"
              value={amountText}
              onChange={(e) => setAmountText(e.target.value)}
              onBlur={commitAmount}
            />
          </div>
          <div className="field">
            <span className="field-label">Stage</span>
            <Select
              value={draft.stage}
              options={DEAL_STAGES.map((s) => ({ value: s, label: s }))}
              onChange={(v) => setDraft({ ...draft, stage: v as DealStage })}
              testId="deal-stage"
            />
          </div>
          <div className="field">
            <span className="field-label">Expected close date</span>
            <DatePicker value={draft.closeDate} onChange={(iso) => setDraft({ ...draft, closeDate: iso })} testId="deal-close-date" />
          </div>
          <div className="field">
            <span className="field-label">Owner</span>
            <Select
              value={draft.ownerId}
              options={users.map((u) => ({ value: u.id, label: u.name }))}
              onChange={(v) => setDraft({ ...draft, ownerId: v })}
            />
          </div>
          <div className="field field-span">
            <span className="field-label">Win probability: {draft.probability}%</span>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={draft.probability}
              onChange={(e) => setDraft({ ...draft, probability: Number(e.target.value) })}
            />
          </div>
          <CustomFieldsSection
            module="deals"
            target="form"
            mode="edit"
            values={draft.customFields ?? {}}
            onChange={(k, v) => setDraft({ ...draft, customFields: { ...draft.customFields, [k]: v } })}
            errors={customErrors}
          />
        </div>

        <div className="form-actions">
          <button className="btn" onClick={() => navigate('/deals')}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={busy} onClick={submit}>
            {busy ? 'Creating…' : 'Create deal'}
          </button>
        </div>
      </div>
    </div>
  );
}
