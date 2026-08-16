import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAll, upsert, removeMany } from '../data/store';
import { Account, Deal, DealStage, DEAL_STAGES, User } from '../types';
import { Modal } from '../components/Modal';
import { SearchableSelect, Select } from '../components/Select';
import { DatePicker } from '../components/DatePicker';
import { Kanban } from '../components/Kanban';
import { ToolBoxPanel } from '../components/ToolBoxPanel';
import { SkeletonRows } from '../components/Spinner';
import { useToast } from '../components/Toast';
import { useAuth } from '../auth/AuthContext';
import { autoCloseDate, formatCurrency, formatDate } from '../utils';
import { applyAssignmentRule, getStatusOptions } from '../utils/rules';

export function Deals() {
  const toast = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [editing, setEditing] = useState<Deal | null>(null);

  const load = async () => {
    const [d, a, u] = await Promise.all([getAll<Deal>('deals'), getAll<Account>('accounts'), getAll<User>('users')]);
    setDeals(d);
    setAccounts(a);
    setUsers(u);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const accountName = (id: string | null) => accounts.find((a) => a.id === id)?.name ?? 'No account';

  const onDrop = async (dealId: string, stage: string) => {
    const deal = deals.find((d) => d.id === dealId);
    if (!deal || deal.stage === stage) return;
    const stamped = autoCloseDate(deal.stage, { ...deal, stage: stage as DealStage });
    // Setup → Assignment Rules: a stage change (e.g. into Closed Won) can itself be a rule condition.
    const assignedTo = applyAssignmentRule('deals', stamped);
    const updated = assignedTo ? { ...stamped, ownerId: assignedTo } : stamped;
    // Optimistic UI so the card moves instantly, then persist.
    setDeals((prev) => prev.map((d) => (d.id === dealId ? updated : d)));
    await upsert('deals', updated);
    toast.push('success', `"${deal.name}" moved to ${stage}.`);
  };

  const saveDeal = async (deal: Deal) => {
    const stamped = editing ? autoCloseDate(editing.stage, deal) : deal;
    const assignedTo = applyAssignmentRule('deals', stamped);
    const toSave = assignedTo ? { ...stamped, ownerId: assignedTo } : stamped;
    await upsert('deals', toSave);
    toast.push('success', `Deal "${deal.name}" saved.`);
    setEditing(null);
    load();
  };

  const deleteDeal = async (deal: Deal) => {
    if (deal.stage === 'Closed Won') {
      toast.push('error', 'Closed Won deals can only be deleted from their detail page.');
      return;
    }
    if (!window.confirm(`Delete deal "${deal.name}"?`)) return;
    await removeMany('deals', [deal.id]);
    toast.push('success', `Deal "${deal.name}" deleted.`);
    setEditing(null);
    load();
  };

  return (
    <div data-testid="deals-page">
      <div className="page-header">
        <h1>Deals</h1>
        <div className="page-actions">
          <button className="btn btn-create" onClick={() => navigate('/deals/new')}>
            + New Deal
          </button>
        </div>
      </div>

      <ToolBoxPanel
        module="deals"
        links={[
          { label: 'Assignment Rules', to: '/setup/assignment-rules' },
          { label: 'Status Codes', to: '/setup/status-codes' },
          { label: 'Custom Fields', to: '/admin/objects/deals' },
          { label: 'Customise Page Layout', to: '/setup/layouts/deals' },
        ]}
      />

      {loading ? (
        <SkeletonRows rows={6} />
      ) : (
        <Kanban
          testId="kanban-board"
          emptyLabel="Drop deals here"
          columns={DEAL_STAGES.map((stage) => {
            const stageDeals = deals.filter((d) => d.stage === stage);
            const total = stageDeals.reduce((sum, d) => sum + d.amount, 0);
            return { key: stage, label: stage, items: stageDeals, headerMeta: `${stageDeals.length} · ${formatCurrency(total)}` };
          })}
          getId={(deal) => deal.id}
          onCardClick={setEditing}
          onDrop={onDrop}
          cardRenderer={(deal) => (
            <>
              <div className="kanban-card-title">{deal.name}</div>
              <div className="kanban-card-account">{accountName(deal.accountId)}</div>
              <div className="kanban-card-foot">
                <span className="kanban-amount">{formatCurrency(deal.amount)}</span>
                <span className="kanban-prob">{deal.probability}%</span>
              </div>
              <div className="kanban-card-date">Close: {formatDate(deal.closeDate)}</div>
            </>
          )}
        />
      )}

      {editing && (
        <DealModal
          deal={editing}
          accounts={accounts}
          users={users}
          onCancel={() => setEditing(null)}
          onSave={saveDeal}
          onDelete={deleteDeal}
        />
      )}
    </div>
  );
}

function DealModal({
  deal,
  accounts,
  users,
  onCancel,
  onSave,
  onDelete,
}: {
  deal: Deal;
  accounts: Account[];
  users: User[];
  onCancel: () => void;
  onSave: (deal: Deal) => void;
  onDelete: (deal: Deal) => void;
}) {
  const [draft, setDraft] = useState<Deal>({ ...deal });
  const [amountText, setAmountText] = useState(deal.amount ? deal.amount.toLocaleString('en-US') : '');
  const [error, setError] = useState<string | null>(null);
  const isNew = !deal.name;

  const commitAmount = () => {
    const parsed = Number(amountText.replace(/[^0-9.]/g, ''));
    const amount = Number.isFinite(parsed) ? Math.round(parsed) : 0;
    setDraft((d) => ({ ...d, amount }));
    setAmountText(amount ? amount.toLocaleString('en-US') : '');
  };

  const submit = () => {
    if (!draft.name.trim()) {
      setError('Deal name is required.');
      return;
    }
    onSave(draft);
  };

  return (
    <Modal
      title={isNew ? 'New deal' : `Edit deal — ${deal.name}`}
      onClose={onCancel}
      footer={
        <>
          {!isNew && (
            <button className="btn btn-danger" onClick={() => onDelete(deal)}>
              Delete
            </button>
          )}
          <button className="btn" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn btn-primary" data-testid="deal-save-btn" onClick={submit}>
            Save deal
          </button>
        </>
      }
    >
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
            options={getStatusOptions('deals', 'stage', DEAL_STAGES).map((s) => ({ value: s, label: s }))}
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
      </div>
    </Modal>
  );
}
