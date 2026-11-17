import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, ChevronDown, Columns3, List, Plus, Search, Sparkles } from 'lucide-react';
import { getAll, upsert } from '../data/store';
import { Account, Deal, User } from '../types';
import { SkeletonRows } from '../components/Spinner';
import { LayoutPickerPanel } from '../components/LayoutPickerPanel';
import { ToolBoxMenu } from '../components/ToolBoxMenu';
import { Select } from '../components/Select';
import { useToast } from '../components/Toast';
import { useAuth } from '../auth/AuthContext';
import { classNames, formatCurrency } from '../utils';
import { TagPicker } from './contacts/contactBits';
import { shortMoney, useNarrow } from './accounts/accountBits';
import { DealSort, DealSortKey, moveDealOptimistic, sortDeals } from './dealsList';
import { CloseFilter, CLOSE_FILTERS, daysUntil, dueInfo, filterPipeline, isOpenStage, StageInfo, stageOf, total, weighted } from './deals/dealLogic';
import {
  bankStages, celebrate, ChanceRing, DealRow, ForecastCards, hueStyle, LostReasonDialog, MiniCrest, movedDeal, PhoneBoard, Runway, RunwayList, StageBoard,
} from './deals/dealBits';

/** The module's set-up shortcuts, shown under the ToolBox button. */
export const DEAL_TOOLBOX_LINKS = [
  { label: 'Import Data', to: '/setup/import' },
  { label: 'Status Codes', to: '/setup/status-codes' },
  { label: 'Assignment Rules', to: '/setup/assignment-rules' },
  { label: 'Custom Fields', to: '/admin/objects/deals' },
  { label: 'Customise Page Layout', to: '/setup/layouts/deals' },
];

type View = 'board' | 'runway' | 'list';

const LIST_COLUMNS: { key: DealSortKey; label: string; num?: boolean }[] = [
  { key: 'name', label: 'Deal' },
  { key: 'stage', label: 'Stage' },
  { key: 'amount', label: 'Amount', num: true },
  { key: 'probability', label: 'Chance', num: true },
  { key: 'closeDate', label: 'Expected close' },
  { key: 'owner', label: 'Owner' },
];

export const canWriteDeals = (role: string | undefined) => role === 'admin' || role === 'rep';

/** The pipeline: a board of stage gates, a forecast runway and a sortable list, with one shared set of filters. */
export function Deals() {
  const toast = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  // Header search "See all": /deals?q=term opens the pipeline already filtered.
  const [query, setQuery] = useState(params.get('q') ?? '');
  const [owners, setOwners] = useState<string[]>([]);
  const [close, setClose] = useState<CloseFilter>('any');
  const [sort, setSort] = useState<DealSort>({ key: 'closeDate', dir: 'asc' });
  const [layoutPickerOpen, setLayoutPickerOpen] = useState(false);
  const [losing, setLosing] = useState<Deal | null>(null);
  const [landedId, setLandedId] = useState<string | null>(null);
  const [fresh, setFresh] = useState(true);
  const narrow = useNarrow();
  const canWrite = canWriteDeals(user?.role);
  const view: View = params.get('view') === 'list' ? 'list' : params.get('view') === 'runway' ? 'runway' : 'board';
  // Dashboard tile link: /deals?stage=open shows open deals only.
  const openOnly = params.get('stage') === 'open';
  const stages = useMemo(() => bankStages(), [deals]);

  const urlQuery = params.get('q') ?? '';
  useEffect(() => {
    setQuery(urlQuery);
  }, [urlQuery, location.state]);

  const load = async () => {
    setLoading(true);
    setFailed(false);
    try {
      // Owner names and account names are extras: a Viewer has no Users access, and the pipeline still opens.
      const [d, a, u] = await Promise.all([
        getAll<Deal>('deals'),
        getAll<Account>('accounts').catch((): Account[] => []),
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

  useEffect(() => {
    load();
  }, []);

  // Cards, gates and bubbles animate in on arrival only, not on every filter change or move.
  useEffect(() => {
    if (loading) return;
    const t = window.setTimeout(() => setFresh(false), 900);
    return () => window.clearTimeout(t);
  }, [loading]);

  const setView = (next: View) => {
    const p = new URLSearchParams(params);
    if (next === 'board') p.delete('view');
    else p.set('view', next);
    setParams(p);
  };

  const accountName = (id: string | null) => accounts.find((a) => a.id === id)?.name ?? 'No account';
  const ownerName = (id: string) => users.find((u) => u.id === id)?.name ?? '—';
  const shown = filterPipeline(deals, { query, owners, close }, accountName).filter((d) => !openOnly || isOpenStage(d.stage));
  const open = shown.filter((d) => isOpenStage(d.stage));
  const late = open.filter((d) => daysUntil(d.closeDate) < 0);
  const won90 = shown.filter((d) => stageOf(stages, d.stage).kind === 'won' && daysUntil(d.closeDate) >= -90);
  const filtering = query.trim() !== '' || owners.length > 0 || close !== 'any';
  const ownerChoices = [...new Set(deals.map((d) => d.ownerId))].map((id) => ({ id, name: ownerName(id) })).sort((a, b) => a.name.localeCompare(b.name));

  const save = async (original: Deal, updated: Deal) => {
    const saved = await moveDealOptimistic(original, updated, async (d) => {
      const stored = await upsert('deals', d);
      // The server adds the stage history; keep its copy.
      setDeals((prev) => prev.map((x) => (x.id === stored.id ? stored : x)));
    }, setDeals);
    if (!saved) toast.push('error', `Couldn't move "${original.name}". It is back in ${original.stage}.`);
    return saved;
  };

  const onMove = async (deal: Deal, target: StageInfo, point: { x: number; y: number }) => {
    if (target.kind === 'lost') {
      setLosing(deal);
      return;
    }
    if (target.kind === 'won') celebrate(point.x, point.y);
    const updated = movedDeal(deal, target, stages);
    setLandedId(deal.id);
    if (await save(deal, updated)) {
      toast.push('success', target.kind === 'won' ? `"${deal.name}" won. Nice work.` : `"${deal.name}" moved to ${target.name} · ${updated.probability}% chance.`);
    }
  };

  const confirmLost = async (reason: string) => {
    const deal = losing;
    const lostStage = stages.find((s) => s.kind === 'lost');
    setLosing(null);
    if (!deal || !lostStage) return;
    setLandedId(deal.id);
    if (await save(deal, movedDeal(deal, lostStage, stages, reason))) toast.push('success', `"${deal.name}" marked as lost.`);
  };

  const clear = () => {
    setQuery('');
    setOwners([]);
    setClose('any');
  };

  const boardProps = { deals: shown, stages, accounts, users, fresh };
  // By close date, open deals come first: a list led by deals closed months ago helps nobody.
  const sorted = sortDeals(shown, sort, accountName, ownerName);
  const listed = sort.key === 'closeDate' ? [...sorted.filter((d) => isOpenStage(d.stage)), ...sorted.filter((d) => !isOpenStage(d.stage))] : sorted;

  return (
    <div className="deal3 deal-list-page" data-testid="deals-page">
      <div className="page-header">
        <div>
          <h1>Deals</h1>
          <p className="page-subtitle">Every opportunity, from first conversation to signed facility.</p>
        </div>
        <div className="page-actions">
          <ToolBoxMenu links={DEAL_TOOLBOX_LINKS} />
          {canWrite && (
            <button className="btn btn-primary contacts-primary" data-testid="new-deal" onClick={() => setLayoutPickerOpen(true)}>
              <Plus size={16} /> New deal
            </button>
          )}
        </div>
      </div>

      {!loading && !failed && (
        <div className="deal-sum" role="status">
          <span><b>{shortMoney(total(open))}</b>open pipeline</span>
          <span><b>{shortMoney(weighted(open))}</b>weighted forecast</span>
          <span><b>{shortMoney(total(won90))}</b>won in the last 90 days</span>
          {late.length > 0 && close !== 'late' && (
            <button type="button" className="deal-late-chip" data-testid="overdue-chip" onClick={() => setClose('late')}>
              <AlertTriangle size={14} aria-hidden="true" /> {late.length} past close date
            </button>
          )}
          {openOnly && (
            <button type="button" className="btn btn-ghost" onClick={() => { const p = new URLSearchParams(params); p.delete('stage'); setParams(p); }}>
              Showing open deals · Show all
            </button>
          )}
        </div>
      )}

      <div className="toolbar contact-tools">
        <div className="contact-find">
          <Search size={17} aria-hidden="true" />
          <input
            type="search"
            className="input search-input"
            aria-label="Search deals"
            placeholder="Search deals or accounts…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <TagPicker
          testId="owner-filter"
          label={<>Owner{owners.length ? ` · ${owners.length}` : ''} <ChevronDown size={14} aria-hidden="true" /></>}
          tags={ownerChoices.map((o) => o.name)}
          selected={ownerChoices.filter((o) => owners.includes(o.id)).map((o) => o.name)}
          onToggle={(name) => {
            const id = ownerChoices.find((o) => o.name === name)?.id;
            if (id) setOwners((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));
          }}
        />
        <div className="deal-close-filter">
          <Select value={close} options={CLOSE_FILTERS} onChange={(v) => setClose(v as CloseFilter)} testId="close-filter" />
        </div>
        {filtering && (
          <button type="button" className="btn btn-ghost" data-testid="clear-filters" onClick={clear}>
            Clear
          </button>
        )}
        <span className="contact-tools-gap" />
        <div className="seg contact-seg" role="group" aria-label="View mode">
          <button type="button" aria-pressed={view === 'board'} data-testid="view-board" onClick={() => setView('board')}>
            <Columns3 size={14} /> Board
          </button>
          <button type="button" aria-pressed={view === 'runway'} data-testid="view-runway" onClick={() => setView('runway')}>
            <Sparkles size={14} /> Runway
          </button>
          <button type="button" aria-pressed={view === 'list'} data-testid="view-list" onClick={() => setView('list')}>
            <List size={14} /> List
          </button>
        </div>
      </div>

      {loading ? (
        <div role="status" aria-label="Loading deals">
          <SkeletonRows rows={6} />
        </div>
      ) : failed ? (
        <div className="banner banner-error contacts-error" role="alert" data-testid="deals-load-error">
          <p>Deals couldn’t load. Check your connection and try again.</p>
          <button type="button" className="btn" onClick={load}>Retry</button>
        </div>
      ) : deals.length === 0 ? (
        <div className="empty-cell" data-testid="deals-empty">
          <strong>No deals yet</strong>
          <p>{canWrite ? 'Create your first deal to start the pipeline.' : 'Deals will appear here once a rep or admin adds them.'}</p>
          {canWrite && (
            <button className="btn btn-primary contacts-primary" onClick={() => setLayoutPickerOpen(true)}>
              <Plus size={16} /> New deal
            </button>
          )}
        </div>
      ) : shown.length === 0 ? (
        <div className="empty-cell" data-testid="deals-no-match">
          <strong>{query.trim() ? `No deals match “${query.trim()}”` : 'No deals match these filters'}</strong>
          <p>Check the spelling, or clear the filters to see all {deals.length} deals.</p>
          <button type="button" className="btn" onClick={clear}>Clear filters</button>
        </div>
      ) : view === 'runway' ? (
        <>
          {narrow ? <RunwayList deals={shown} stages={stages} accounts={accounts} /> : <Runway {...boardProps} />}
          {!narrow && <ForecastCards deals={shown} fresh={fresh} />}
        </>
      ) : view === 'list' ? (
        narrow ? (
          <div className="card deal-grp" data-testid="deals-list">
            {listed.map((d) => <DealRow key={d.id} deal={d} stages={stages} accounts={accounts} />)}
          </div>
        ) : (
          <div className="card deal-table" data-testid="deals-list">
            <table className="table">
              <thead>
                <tr>
                  {LIST_COLUMNS.map((c) => (
                    <th key={c.key} scope="col" className={c.num ? 'num' : undefined} aria-sort={sort.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                      <button type="button" className="th-sort" onClick={() => setSort((s) => ({ key: c.key, dir: s.key === c.key && s.dir === 'asc' ? 'desc' : 'asc' }))}>
                        {c.label}{sort.key === c.key ? (sort.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {listed.map((d, i) => {
                  const stage = stageOf(stages, d.stage);
                  const due = dueInfo(d);
                  const account = accounts.find((a) => a.id === d.accountId);
                  return (
                    <tr key={d.id} className="deal-tr" style={{ animationDelay: `${fresh ? Math.min(i, 14) * 22 : 0}ms` }} onClick={() => navigate(`/deals/${d.id}`)}>
                      <td data-label="Deal">
                        <div className="deal-nm">
                          <MiniCrest account={account} />
                          <div>
                            <Link to={`/deals/${d.id}`} onClick={(e) => e.stopPropagation()}>{d.name}</Link>
                            <small>{account?.name ?? 'No account'}</small>
                          </div>
                        </div>
                      </td>
                      <td data-label="Stage"><span className="deal-pill" style={hueStyle(stage.hue)}><i />{d.stage}</span></td>
                      <td className="num" data-label="Amount" title={formatCurrency(d.amount)}>{shortMoney(d.amount)}</td>
                      <td className="num" data-label="Chance"><span className="deal-chance"><ChanceRing value={d.probability} size={22} stroke={3} hue={stage.hue} delay={0} />{d.probability}%</span></td>
                      <td data-label="Expected close"><span className={classNames('deal-due', due.tone)}>{due.text}</span></td>
                      <td data-label="Owner">{ownerName(d.ownerId)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      ) : narrow ? (
        <PhoneBoard {...boardProps} />
      ) : (
        <StageBoard {...boardProps} canWrite={canWrite} landedId={landedId} onMove={onMove} />
      )}

      {losing && <LostReasonDialog deal={losing} onCancel={() => setLosing(null)} onConfirm={confirmLost} />}
      {layoutPickerOpen && <LayoutPickerPanel module="deals" basePath="/deals" onClose={() => setLayoutPickerOpen(false)} />}
    </div>
  );
}
