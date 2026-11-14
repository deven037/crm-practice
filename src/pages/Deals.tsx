import { ComponentProps, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { getAll, upsert, removeMany } from '../data/store';
import { Account, Deal, DealStage, DEAL_STAGES, User } from '../types';
import { CustomFieldsSection, validateCustomFields } from '../components/CustomFieldsSection';
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
import { DealSort, DealSortKey, filterDeals, moveDealOptimistic, sortDeals } from './dealsList';

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
  const [deleting, setDeleting] = useState<Deal | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [sort, setSort] = useState<DealSort>({ key: 'createdAt', dir: 'desc' });
  const [stageFilter, setStageFilter] = useState(openOnly ? 'open' : '');
  const [listQuery, setListQuery] = useState(searchTerm);
  const isList = params.get('view') === 'list';
  const canWrite = user?.role === 'admin' || user?.role === 'rep';
  const stages = getStatusOptions('deals', 'stage', DEAL_STAGES);
  const visibleDeals = deals.filter((d) => (!openOnly || !d.stage.startsWith('Closed')) && d.name.toLowerCase().includes(searchTerm));
  const openValue = deals.filter((d) => !d.stage.startsWith('Closed')).reduce((sum, d) => sum + d.amount, 0);

  const load = async () => {
    setLoading(true);
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
    const saved = await moveDealOptimistic(deal, updated, (d) => upsert('deals', d), setDeals);
    if (saved) {
      toast.push('success', `"${deal.name}" moved to ${stage}.`);
    } else {
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
    setDeleteError(null);
    setDeleting(deal);
  };

  const confirmDelete = async () => {
    if (!deleting || deleteBusy) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await removeMany('deals', [deleting.id]);
      toast.push('success', `Deal "${deleting.name}" deleted.`);
      setDeleting(null);
      setEditing(null);
      await load();
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'The deal could not be deleted. Try again.');
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <div className="deals-screen" data-testid="deals-page">
      <div className="page-header">
        <div><h1>Deals</h1><p className="page-subtitle">Every open and closed deal, by stage.</p></div>
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
          {isList ? <SkeletonRows rows={6} /> : <div className="kanban">{stages.map((stage) => <div className="kanban-col" key={stage}><SkeletonRows rows={4} /></div>)}</div>}
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
          users={users}
          stages={stages}
          sort={sort}
          onSort={(key) => setSort((s) => ({ key, dir: s.key === key && s.dir === 'desc' ? 'asc' : 'desc' }))}
          query={listQuery}
          onQuery={setListQuery}
          stage={stageFilter}
          onStage={setStageFilter}
          accountName={accountName}
          ownerName={(id) => users.find((u) => u.id === id)?.name ?? '—'}
        />
      ) : visibleDeals.length === 0 ? (
        <div className="empty-cell"><strong>No deals match these filters.</strong><p>Clear the filters to see all deals.</p><button className="btn" onClick={() => setParams({})}>Clear filters</button></div>
      ) : (
        <>
        <p className="deals-summary" role="status"><b>{visibleDeals.length} deals</b> · <b>{formatCurrency(visibleDeals.reduce((sum, d) => sum + d.amount, 0))}</b> total · <b>{formatCurrency(openValue)}</b> open</p>
        <Kanban
          testId="kanban-board"
          emptyLabel={canWrite ? 'No deals in this stage. Use “Move to…” on a deal or drag one here.' : 'No deals in this stage.'}
          getLabel={(deal) => deal.name}
          readOnly={!canWrite}
          columns={stages.filter((stage) => !openOnly || !stage.startsWith('Closed')).map((stage) => {
            const stageDeals = visibleDeals.filter((d) => d.stage === stage);
            const total = stageDeals.reduce((sum, d) => sum + d.amount, 0);
            const share = openValue > 0 && !stage.startsWith('Closed') ? Math.round(total / openValue * 100) : 0;
            return { key: stage, label: stage, items: stageDeals, headerMeta: <><span className="deals-stage-count">{stageDeals.length} deals</span><strong>{formatCurrency(total)}</strong>{!stage.startsWith('Closed') && <><progress max={100} value={share} aria-label={`${stage}: ${share}% of open value`} /><small>{share}% of open value</small></>}</> };
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
                <span className="kanban-prob">{deal.probability}%<progress max={100} value={deal.probability} aria-label={`Win probability ${deal.probability}%`} /></span>
              </div>
              <div className="kanban-card-date">Close: {formatDate(deal.closeDate)}</div>
            </>
          )}
        />
        </>
      )}

      {editing && !deleting && (
        <DealModal
          deal={editing}
          accounts={accounts}
          users={users}
          onCancel={() => setEditing(null)}
          onSave={saveDeal}
          onDelete={deleteDeal}
        />
      )}
      {deleting && (
        <DealDialog title={`Delete deal: ${deleting.name}`} onClose={() => { if (!deleteBusy) setDeleting(null); }}
          footer={<><button className="btn" disabled={deleteBusy} onClick={() => setDeleting(null)}>Cancel</button><button className="btn btn-danger" data-testid="confirm-delete-btn" disabled={deleteBusy} onClick={confirmDelete}>{deleteBusy ? 'Deleting…' : 'Delete deal'}</button></>}>
          {deleteError && <div className="banner banner-error" role="alert">{deleteError}</div>}
          <p>Delete “{deleting.name}” ({formatCurrency(deleting.amount)}, {deleting.stage})? This cannot be undone.</p>
        </DealDialog>
      )}
    </div>
  );
}

function DealsTable({
  deals,
  users,
  stages,
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
  users: User[];
  stages: string[];
  sort: DealSort;
  onSort: (key: DealSortKey) => void;
  query: string;
  onQuery: (q: string) => void;
  stage: string;
  onStage: (s: string) => void;
  accountName: (id: string | null) => string;
  ownerName: (id: string) => string;
}) {
  const [owner, setOwner] = useState('');
  const rows = sortDeals(filterDeals(deals, { query, stage, owner }, accountName), sort, accountName, ownerName);
  const total = rows.reduce((sum, d) => sum + d.amount, 0);
  const clear = () => {
    onQuery('');
    onStage('');
    setOwner('');
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
          {stages.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select className="input" aria-label="Filter by owner" value={owner} onChange={(e) => setOwner(e.target.value)}>
          <option value="">All owners</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
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
                  <td data-label="Stage"><span className={`deals-stage ${d.stage === 'Closed Won' ? 'won' : d.stage === 'Closed Lost' ? 'lost' : d.stage === 'Qualification' ? '' : 'mid'}`}>{d.stage}</span></td>
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

export function DealModal({
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
  onSave: (deal: Deal) => Promise<void>;
  onDelete: (deal: Deal) => void;
}) {
  const [draft, setDraft] = useState<Deal>({ ...deal });
  const [amountText, setAmountText] = useState(deal.amount ? deal.amount.toLocaleString('en-US') : '');
  const [error, setError] = useState<string | null>(null);
  const isNew = !deal.name;
  const [busy, setBusy] = useState(false);
  const [customErrors, setCustomErrors] = useState<Record<string, string>>({});
  const nameRef = useRef<HTMLInputElement>(null);

  const commitAmount = () => {
    const parsed = Number(amountText.replace(/[^0-9.]/g, ''));
    const amount = Number.isFinite(parsed) ? Math.round(parsed) : 0;
    setDraft((d) => ({ ...d, amount }));
    setAmountText(amount ? amount.toLocaleString('en-US') : '');
  };

  const submit = async () => {
    if (busy) return;
    setError(null);
    const errors = validateCustomFields('deals', 'form', draft.customFields ?? {});
    setCustomErrors(errors);
    if (!draft.name.trim()) {
      setError('Deal name is required.');
      nameRef.current?.focus();
      return;
    }
    if (Object.keys(errors).length) return;
    setBusy(true);
    try {
      await onSave(draft);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'The deal could not be saved. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <DealDialog
      title={isNew ? 'New deal' : `Edit deal — ${deal.name}`}
      onClose={() => { if (!busy) onCancel(); }}
      footer={
        <>
          {!isNew && (
            <button className="btn btn-danger" disabled={busy} onClick={() => onDelete(deal)}>
              Delete
            </button>
          )}
          <button className="btn" disabled={busy} onClick={onCancel}>
            Cancel
          </button>
          <button className="btn btn-primary" data-testid="deal-save-btn" type="submit" form="deal-edit-form" disabled={busy}>
            {busy ? 'Saving…' : 'Save deal'}
          </button>
        </>
      }
    >
      {error && <div className="banner banner-error" role="alert">{error}</div>}
      <form id="deal-edit-form" onSubmit={(event) => { event.preventDefault(); void submit(); }}><fieldset className="deals-edit-fields" disabled={busy}><div className="form-grid">
        <div className="field">
          <label className="field-label" htmlFor="deal-edit-name">Deal name *</label>
          <input ref={nameRef} id="deal-edit-name" aria-invalid={!draft.name.trim() && error ? true : undefined} aria-describedby={!draft.name.trim() && error ? "deal-edit-name-error" : undefined} className="input" data-testid="deal-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          {!draft.name.trim() && error && <span id="deal-edit-name-error" className="field-error">Deal name is required.</span>}
        </div>
        <div className="field">
          <label className="field-label" htmlFor="deal-edit-account">Account</label>
          <SearchableSelect
            id="deal-edit-account"
            value={draft.accountId ?? ''}
            options={accounts.map((a) => ({ value: a.id, label: a.name }))}
            onChange={(v) => setDraft({ ...draft, accountId: v })}
            placeholder="Search accounts…"
            testId="deal-account"
          />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="deal-edit-amount">Amount</label>
          <input
            className="input"
            id="deal-edit-amount"
            data-testid="deal-amount"
            placeholder="e.g. 25,000"
            value={amountText}
            onChange={(e) => setAmountText(e.target.value)}
            onBlur={commitAmount}
          />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="deal-edit-stage">Stage</label>
          <Select
            id="deal-edit-stage"
            value={draft.stage}
            options={getStatusOptions('deals', 'stage', DEAL_STAGES).map((s) => ({ value: s, label: s }))}
            onChange={(v) => setDraft({ ...draft, stage: v as DealStage })}
            testId="deal-stage"
          />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="deal-edit-close">Expected close date</label>
          <DatePicker id="deal-edit-close" value={draft.closeDate} onChange={(iso) => setDraft({ ...draft, closeDate: iso })} testId="deal-close-date" />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="deal-edit-owner">Owner</label>
          <Select
            id="deal-edit-owner"
            value={draft.ownerId}
            options={users.map((u) => ({ value: u.id, label: u.name }))}
            onChange={(v) => setDraft({ ...draft, ownerId: v })}
          />
        </div>
        <div className="field field-span">
          <label className="field-label" htmlFor="deal-edit-probability">Win probability: {draft.probability}%</label>
          <input
            id="deal-edit-probability"
            type="range"
            min={0}
            max={100}
            step={5}
            value={draft.probability}
            onChange={(e) => setDraft({ ...draft, probability: Number(e.target.value) })}
          />
        </div>
        <CustomFieldsSection module="deals" target="form" mode="edit" values={draft.customFields ?? {}} errors={customErrors} onChange={(key, value) => setDraft({ ...draft, customFields: { ...draft.customFields, [key]: value } })} />
      </div></fieldset></form>
    </DealDialog>
  );
}

function DealDialog({ children, ...props }: ComponentProps<typeof Modal>) {
  const bodyRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const opener = document.activeElement;
    const dialog = bodyRef.current?.closest<HTMLElement>('[role="dialog"]');
    if (!dialog) return;
    const controls = () => Array.from(dialog.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href], [tabindex="0"]')).filter((node) => node.getClientRects().length > 0);
    const cancel = Array.from(dialog.querySelectorAll('button')).find((button) => button.textContent === 'Cancel');
    (cancel ?? controls()[0])?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const nodes = controls();
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
        event.preventDefault(); last?.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
        event.preventDefault(); first.focus();
      }
    };
    document.addEventListener('keydown', trap);
    return () => {
      document.removeEventListener('keydown', trap);
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, []);
  return <Modal {...props}><div className="deals-dialog" ref={bodyRef}>{children}</div></Modal>;
}
