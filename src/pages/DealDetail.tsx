import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getAllSync, getById, logAudit, removeMany, upsert } from '../data/store';
import { Account, Deal, DealStage, DEAL_STAGES, Quote, User } from '../types';
import { Modal } from '../components/Modal';
import { SearchableSelect, Select } from '../components/Select';
import { DatePicker } from '../components/DatePicker';
import { CustomFieldsSection } from '../components/CustomFieldsSection';
import { Spinner } from '../components/Spinner';
import { useToast } from '../components/Toast';
import { useAuth } from '../auth/AuthContext';
import { autoCloseDate, formatCurrency, formatDate } from '../utils';

export function DealDetail() {
  const { id } = useParams();
  const toast = useToast();
  const [deal, setDeal] = useState<Deal | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Deal | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    (async () => {
      const d = await getById<Deal>('deals', id ?? '');
      if (!d) setNotFound(true);
      else setDeal(d);
    })();
  }, [id]);

  if (notFound) {
    return (
      <div className="empty-cell">
        Deal not found. <Link to="/deals">Back to deals</Link>
      </div>
    );
  }
  if (!deal) return <Spinner label="Loading deal…" />;

  const accounts = getAllSync<Account>('accounts');
  const users = getAllSync<User>('users');
  const quotes = getAllSync<Quote>('quotes');
  const account = accounts.find((a) => a.id === deal.accountId);
  const ownerName = users.find((u) => u.id === deal.ownerId)?.name ?? '—';
  const linkedQuote = quotes.find((q) => q.dealId === deal.id);

  const save = async () => {
    if (!draft) return;
    if (!draft.name.trim()) {
      toast.push('error', 'Deal name is required.');
      return;
    }
    const toSave = autoCloseDate(deal.stage, draft);
    await upsert('deals', toSave);
    setDeal(toSave);
    setEditing(false);
    toast.push('success', 'Deal updated.');
  };

  return (
    <div data-testid="deal-detail-page">
      <nav className="breadcrumbs">
        <Link to="/deals">Deals</Link> <span>/</span> <span>{deal.name}</span>
      </nav>

      <div className="page-header">
        <h1>{deal.name}</h1>
        <div className="page-actions">
          <span className="pill ticket-open" data-testid="deal-detail-stage">
            {deal.stage}
          </span>
          {!editing ? (
            <>
              <button
                className="btn"
                data-testid="edit-deal-btn"
                onClick={() => {
                  setDraft({ ...deal });
                  setEditing(true);
                }}
              >
                ✏️ Edit
              </button>
              <button
                className="btn btn-danger"
                data-testid="delete-deal-btn"
                onClick={() => {
                  setConfirmText('');
                  setDeleting(true);
                }}
              >
                🗑 Delete
              </button>
            </>
          ) : (
            <>
              <button className="btn" onClick={() => setEditing(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" data-testid="save-deal-btn" onClick={save}>
                Save
              </button>
            </>
          )}
        </div>
      </div>

      <div className="card">
        {!editing ? (
          <dl className="detail-list">
            <dt>Account</dt>
            <dd>{account ? <Link to={`/accounts/${account.id}`}>{account.name}</Link> : '—'}</dd>
            <dt>Amount</dt>
            <dd>{formatCurrency(deal.amount)}</dd>
            <dt>Stage</dt>
            <dd>{deal.stage}</dd>
            <dt>Win probability</dt>
            <dd>{deal.probability}%</dd>
            <dt>Expected close</dt>
            <dd>{formatDate(deal.closeDate)}</dd>
            <dt>Owner</dt>
            <dd>{ownerName}</dd>
            <dt>Created</dt>
            <dd>{formatDate(deal.createdAt)}</dd>
            <dt>Linked quote</dt>
            <dd>{linkedQuote ? <Link to={`/quotes/${linkedQuote.id}`}>{linkedQuote.quoteNumber}</Link> : '—'}</dd>
            <CustomFieldsSection module="deals" target="detail" mode="view" values={deal.customFields ?? {}} />
          </dl>
        ) : (
          draft && (
            <div className="form-grid">
              <div className="field">
                <span className="field-label">Deal name *</span>
                <input className="input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              </div>
              <div className="field">
                <span className="field-label">Account</span>
                <SearchableSelect
                  value={draft.accountId ?? ''}
                  options={accounts.map((a) => ({ value: a.id, label: a.name }))}
                  onChange={(v) => setDraft({ ...draft, accountId: v })}
                  placeholder="Search accounts…"
                />
              </div>
              <div className="field">
                <span className="field-label">Amount ($)</span>
                <input
                  className="input"
                  type="number"
                  value={draft.amount}
                  onChange={(e) => setDraft({ ...draft, amount: Number(e.target.value) })}
                />
              </div>
              <div className="field">
                <span className="field-label">Stage</span>
                <Select
                  value={draft.stage}
                  options={DEAL_STAGES.map((s) => ({ value: s, label: s }))}
                  onChange={(v) => setDraft({ ...draft, stage: v as DealStage })}
                />
              </div>
              <div className="field">
                <span className="field-label">Expected close date</span>
                <DatePicker value={draft.closeDate} onChange={(iso) => setDraft({ ...draft, closeDate: iso })} />
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
                target="detail"
                mode="edit"
                values={draft.customFields ?? {}}
                onChange={(k, v) => setDraft({ ...draft, customFields: { ...draft.customFields, [k]: v } })}
              />
            </div>
          )
        )}
      </div>

      {deleting && (
        <Modal
          title={`Delete deal — ${deal.name}`}
          onClose={() => setDeleting(false)}
          footer={
            <>
              <button className="btn" onClick={() => setDeleting(false)}>
                Cancel
              </button>
              <button
                className="btn btn-danger"
                data-testid="confirm-delete-btn"
                disabled={deal.stage === 'Closed Won' && confirmText !== 'DELETE'}
                onClick={async () => {
                  await removeMany('deals', [deal.id]);
                  logAudit(user?.name ?? 'Unknown', 'deal.delete', `Deleted deal ${deal.name} (${deal.stage})`);
                  toast.push('success', `Deal "${deal.name}" deleted.`);
                  navigate('/deals');
                }}
              >
                Delete deal
              </button>
            </>
          }
        >
          {deal.stage === 'Closed Won' ? (
            <>
              <div className="banner banner-error" role="alert" data-testid="closed-won-warning">
                This deal is <strong>Closed Won</strong> — deleting it removes {formatCurrency(deal.amount)} from won
                revenue and your dashboard history.
              </div>
              <div className="field">
                <span className="field-label">Type DELETE to confirm</span>
                <input
                  className="input"
                  data-testid="delete-confirm-input"
                  placeholder="DELETE"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                />
              </div>
            </>
          ) : (
            <p>Delete “{deal.name}” ({formatCurrency(deal.amount)}, {deal.stage})? This cannot be undone.</p>
          )}
        </Modal>
      )}
    </div>
  );
}
