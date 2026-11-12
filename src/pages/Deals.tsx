import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
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
import { DealSort, DealSortKey, filterDeals, sortDeals } from './dealsList';

const LIST_COLUMNS: { key: DealSortKey; label: string; num?: boolean }[] = [
  { key: 'name', label: 'Deal' },
  { key: 'account', label: 'Account' },
  { key: 'stage', label: 'Stage' },
  { key: 'amount', label: 'Amount', num: true },
  { key: 'probability', label: 'Probability', num: true },
  { key: 'closeDate', label: 'Expected close' },
  { key: 'owner', label: 'Owner' },
];

export function Deals() {
  const toast = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  // Dashboard tile link: /deals?stage=open hides the Closed columns.
  const openOnly = params.get('stage') === 'open';
  // Header search "See all": /deals?q=term shows only deals whose name matches.
  const searchTerm = (params.get('q') ?? '').trim().toLowerCase();
  const [loading, setLoading] = useState(true);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [editing, setEditing] = useState<Deal | null>(null);
  const [failed, setFailed] = useState(false);
  const [sort, setSort] = useState<DealSort>({ key: 'amount', dir: 'desc' });
  const [stageFilter, setStageFilter] = useState(openOnly ? 'open' : '');
  const [listQuery, setListQuery] = useState(searchTerm);
  const isList = params.get('view') === 'list';
  const canWrite = user?.role !== 'viewer';

  const load = async () => {
    setFailed(false);
    try {
      // A Viewer gets 403 on /users; fall back to an empty list so the board still renders.
      const [d, a, u] = await Promise.all([
        getAll<Deal>('deals'),
        getAll<Account>('accounts'),
        getAll<User>('users').catch((): User[] => []),
      ]);
      setDeals(d);
      setAccounts(a);
      setUsers(u);
    } catch {
      setFailed(true);
    }
    setLoading(false);
  };

  const setView = (view: 'board' | 'list') => {
    const next = new URLSearchParams(params);
    if (view === 'list') next.set('view', 'list');
    else next.delete('view');
    setParams(next);
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
    try {
      await upsert('deals', updated);
      toast.push('success', `"${deal.name}" moved to ${stage}.`);
    } catch {
      setDeals((prev) => prev.map((d) => (d.id === dealId ? deal : d)));
      toast.push('error', `Couldn't move "${deal.name}" to ${stage}. It is back in ${deal.stage}.`);
    }
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
          {openOnly && (
            <button className="btn" onClick={() => setParams({})}>
              Showing open deals · Show all
            </button>
          )}
          {searchTerm && (
            <button className="btn" onClick={() => setParams({})}>
              Filtered by "{searchTerm}" · Clear
            </button>
          )}
          <div className="segmented" role="group" aria-label="View">
            <button type="button" className={`segmented-option${isList ? '' : ' active'}`} aria-pressed={!isList} onClick={() => setView('board')}>
              Board
            </button>
            <button type="button" className={`segmented-option${isList ? ' active' : ''}`} aria-pressed={isList} onClick={() => setView('list')}>
              List
            </button>
          </div>
          {canWrite && (
            <button className="btn btn-create" onClick={() => navigate('/deals/new')}>
              + New Deal
            </button>
          )}
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
        <div role="status" aria-label="Loading deals">
          <SkeletonRows rows={6} />
        </div>
      ) : failed ? (
        <div className="banner banner-error" role="alert">
          Deals could not be loaded. Check your connection, then try again.{' '}
          <button className="btn" onClick={load}>
            Retry
          </button>
        </div>
      ) : deals.length === 0 ? (
        <div className="empty-cell" data-testid="deals-empty">
          <p>
            <strong>No deals yet.</strong>
          </p>
          <p>{canWrite ? 'Create your first deal to start the pipeline.' : 'Deals will appear here once a rep or admin adds them.'}</p>
          {canWrite && (
            <button className="btn btn-create" onClick={() => navigate('/deals/new')}>
              + New Deal
            </button>
          )}
        </div>
      ) : isList ? (
        <DealsTable
          deals={deals}
          sort={sort}
          onSort={(key) => setSort((s) => ({ key, dir: s.key === key && s.dir === 'desc' ? 'asc' : 'desc' }))}
          query={listQuery}
          onQuery={setListQuery}
          stage={stageFilter}
          onStage={setStageFilter}
          accountName={accountName}
          ownerName={(id) => users.find((u) => u.id === id)?.name ?? '—'}
        />
      ) : (
        <Kanban
          testId="kanban-board"
          emptyLabel={canWrite ? 'No deals in this stage. Use “Move to…” on a deal or drag one here.' : 'No deals in this stage.'}
          getLabel={(deal) => deal.name}
          readOnly={!canWrite}
          columns={DEAL_STAGES.filter((stage) => !openOnly || !stage.startsWith('Closed')).map((stage) => {
            const stageDeals = deals.filter((d) => d.stage === stage && d.name.toLowerCase().includes(searchTerm));
            const total = stageDeals.reduce((sum, d) => sum + d.amount, 0);
            return { key: stage, label: stage, items: stageDeals, headerMeta: `${stageDeals.length} · ${formatCurrency(total)}` };
          })}
          getId={(deal) => deal.id}
          onCardClick={(deal) => (canWrite ? setEditing(deal) : navigate(`/deals/${deal.id}`))}
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

function DealsTable({
  deals,
  sort,
  onSort,
  query,
  onQuery,
  stage,
  onStage,
  accountName,
  ownerName,
}: {
  deals: Deal[];
  sort: DealSort;
  onSort: (key: DealSortKey) => void;
  query: string;
  onQuery: (q: string) => void;
  stage: string;
  onStage: (s: string) => void;
  accountName: (id: string | null) => string;
  ownerName: (id: string) => string;
}) {
  const rows = sortDeals(filterDeals(deals, { query, stage }, accountName), sort, accountName, ownerName);
  const total = rows.reduce((sum, d) => sum + d.amount, 0);
  const clear = () => {
    onQuery('');
    onStage('');
  };
  return (
    <div data-testid="deals-list">
      <div className="toolbar deals-list-toolbar">
        <input
          className="input"
          type="search"
          aria-label="Search deals"
          placeholder="Search by deal or account…"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
        />
        <select className="input" aria-label="Filter by stage" value={stage} onChange={(e) => onStage(e.target.value)}>
          <option value="">All stages</option>
          <option value="open">Open deals</option>
          {DEAL_STAGES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <span className="muted" role="status">
          {rows.length} {rows.length === 1 ? 'deal' : 'deals'} · {formatCurrency(total)}
        </span>
      </div>
      {rows.length === 0 ? (
        <div className="empty-cell">
          <p>
            <strong>No deals match{query.trim() ? ` “${query.trim()}”` : ' these filters'}.</strong>
          </p>
          <p>Check the spelling or clear the filters to see all {deals.length} deals.</p>
          <button className="btn" onClick={clear}>
            Clear filters
          </button>
        </div>
      ) : (
        <div className="table-wrap deals-table">
          <table className="table">
            <thead>
              <tr>
                {LIST_COLUMNS.map((c) => (
                  <th
                    key={c.key}
                    scope="col"
                    className={c.num ? 'num' : undefined}
                    aria-sort={sort.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  >
                    <button type="button" className="th-sort" onClick={() => onSort(c.key)}>
                      {c.label}
                      {sort.key === c.key ? (sort.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.id}>
                  <td data-label="Deal">
                    <Link to={`/deals/${d.id}`}>{d.name}</Link>
                  </td>
                  <td data-label="Account">{accountName(d.accountId)}</td>
                  <td data-label="Stage">{d.stage}</td>
                  <td className="num" data-label="Amount">
                    {formatCurrency(d.amount)}
                  </td>
                  <td className="num" data-label="Probability">
                    {d.probability}%
                  </td>
                  <td data-label="Expected close">{formatDate(d.closeDate)}</td>
                  <td data-label="Owner">{ownerName(d.ownerId)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
