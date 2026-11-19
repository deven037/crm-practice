import { CSSProperties, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { EyeOff, GripVertical, Plus, SlidersHorizontal } from 'lucide-react';
import { apiFetch } from '../data/apiFetch';
import { bankProfileSync, getAll, getAllSync, upsert } from '../data/store';
import { Account, Activity, Campaign, DashboardCard, DashboardLayout, Deal, LEAD_STATUSES, Lead, Meeting, Quote, TaskItem, Ticket, User } from '../types';
import { Select } from '../components/Select';
import { SkeletonRows } from '../components/Spinner';
import { useToast } from '../components/Toast';
import { useAuth } from '../auth/AuthContext';
import { classNames } from '../utils';
import { getStatusOptions } from '../utils/rules';
import { money, moneyShort, plural, quoteSettingsNow } from './quotes/quoteLogic';
import { bankStages } from './deals/dealBits';
import { stageKind } from './deals/dealLogic';
import { isOpenTicket } from './tickets/ticketLogic';
import {
  bandRows, buckets, CARD_MIN, CARD_TITLES, CardId, cleanLayout, dayAgenda, DAY, defaultScope, inScope, monthOutcome, monthSeries, moveCard, nearBreach,
  NeedItem, needsFor, notSnoozed, periodPair, RANGES, resized, rowsForHeight, Scope, SNOOZE_MS, stageRiver, startOfDay, teamRows, waffle,
} from './dashboard/dashLogic';
import {
  CardHead, ClosingList, DayList, Delta, Feed, GetStarted, MonthChart, MonthFigures, NeedsCard, PulseCard, PulseTile, River, TeamTable, Unavailable, Waffle,
} from './dashboard/dashCards';

const LOAD_TIMEOUT_MS = 10_000;
type DataKey = 'leads' | 'deals' | 'tasks' | 'tickets' | 'activities' | 'meetings' | 'quotes' | 'campaigns';
const DATA_KEYS: DataKey[] = ['leads', 'deals', 'tasks', 'tickets', 'activities', 'meetings', 'quotes', 'campaigns'];
const LEAD_HUES = ['#2f6fe0', '#0f97a8', '#1f9d63', '#7a4fd6', '#8a93a6', '#c98a12', '#d9467a', '#d9642b'];

function withTimeout<T>(p: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), LOAD_TIMEOUT_MS);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

const read = <T,>(key: string, fallback: T): T => {
  try { const raw = localStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : fallback; } catch { return fallback; }
};
const write = (key: string, value: unknown) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage off: the choice lasts this visit */ } };

function useWidth<T extends HTMLElement>(): [React.RefObject<T>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

/**
 * The Dashboard: a personal morning brief. A greeting sums up the day; Needs you stacks what wants attention now
 * from every module; Month so far, Pulse, Your day, Deals by stage, Leads by status, Team and Recent activity follow.
 * Each person arranges it in Customise: drag a card anywhere to move it, drag its edges or corner to size it.
 */
export function Dashboard() {
  const { user } = useAuth();
  const bank = bankProfileSync();
  const bankName = bank?.name?.trim() || 'Your bank';
  const toast = useToast();
  const canWrite = user?.role === 'admin' || user?.role === 'rep';
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState<DataKey[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [range, setRange] = useState(() => read('crm.dashRange', '30'));
  const [scope, setScope] = useState<Scope>(() => (user?.role === 'viewer' ? 'bank' : read<Scope>('crm.dashScope', defaultScope(user?.role))));
  const [snoozed, setSnoozed] = useState<Record<string, number>>(() => read(`crm.dashSnooze.${user?.id ?? ''}`, {}));
  const [stage, setStage] = useState<string | null>(null);
  const [leadFocus, setLeadFocus] = useState<string | null>(null);
  const [cards, setCards] = useState<DashboardCard[]>(() => cleanLayout(null));
  const [bankLayout, setBankLayout] = useState<DashboardLayout | null>(null);
  const [savedJson, setSavedJson] = useState('');
  const [edit, setEdit] = useState(false);
  const [auto, setAuto] = useState<Record<string, number>>({});
  const [now, setNow] = useState(() => Date.now());
  const retryRef = useRef<HTMLButtonElement>(null);
  const focusRetry = useRef(false);
  const loadId = useRef(0);
  const [gridRef, gridWidth] = useWidth<HTMLDivElement>();

  const load = useCallback(async (only?: DataKey[]) => {
    const id = ++loadId.current;
    setLoading(true);
    const loaders: Record<DataKey, () => Promise<unknown>> = {
      leads: async () => setLeads([...(await withTimeout(getAll<Lead>('leads')))]),
      deals: async () => setDeals([...(await withTimeout(getAll<Deal>('deals')))]),
      tasks: async () => setTasks([...(await withTimeout(getAll<TaskItem>('tasks')))]),
      tickets: async () => setTickets([...(await withTimeout(getAll<Ticket>('tickets')))]),
      activities: async () => setActivities([...(await withTimeout(getAll<Activity>('activities')))].sort((a, b) => Date.parse(b.when) - Date.parse(a.when))),
      meetings: async () => setMeetings([...(await withTimeout(getAll<Meeting>('meetings')))]),
      quotes: async () => setQuotes([...(await withTimeout(getAll<Quote>('quotes')))]),
      campaigns: async () => setCampaigns([...(await withTimeout(getAll<Campaign>('campaigns')))]),
    };
    const keys = only ?? DATA_KEYS;
    const results = await Promise.allSettled(keys.map((k) => loaders[k]()));
    if (id !== loadId.current) return;
    const stillFailed = keys.filter((_, i) => results[i].status === 'rejected');
    setFailed((prev) => [...prev.filter((k) => !keys.includes(k)), ...stillFailed]);
    setNow(Date.now());
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    // The person's saved arrangement, else the bank's; without either the built-in one stays.
    apiFetch<{ mine: DashboardLayout | null; bank: DashboardLayout | null }>('/dashboard/layout').then(
      ({ mine, bank: b }) => {
        setBankLayout(b);
        const next = cleanLayout(mine?.cards ?? b?.cards);
        setCards(next);
        setSavedJson(JSON.stringify(next));
      },
      () => setSavedJson(JSON.stringify(cleanLayout(null))),
    );
    const tick = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => { loadId.current++; window.clearInterval(tick); };
  }, [load]);

  useEffect(() => {
    // Welcome toast once per browser session — an auto-appearing element to handle in tests.
    if (user && !sessionStorage.getItem('crm.welcomed')) {
      sessionStorage.setItem('crm.welcomed', '1');
      toast.push('info', `Welcome back, ${user.name.split(' ')[0]}!`);
    }
  }, [user, toast]);

  useEffect(() => {
    if (!loading && focusRetry.current) { focusRetry.current = false; retryRef.current?.focus(); }
  }, [loading]);

  const users = getAllSync<User>('users');
  const accounts = getAllSync<Account>('accounts');
  const accountName = (id: string | null) => accounts.find((a) => a.id === id)?.name ?? '';
  const me = user?.id;
  const mine = <T extends { ownerId?: string | null }>(list: T[]) => list.filter((x) => inScope(scope, me, x.ownerId));
  const days = Number(range);
  const rangeLabel = RANGES.find((r) => r.value === range)?.label ?? `Last ${days} days`;
  const isFailed = (k: DataKey) => failed.includes(k);
  const retryOne = (k: DataKey) => () => load([k]);

  // ---------- figures ----------
  const settings = quoteSettingsNow();
  const meUser = users.find((u) => u.id === me) ?? (user ? ({ ...user, email: '', active: true } as User) : null);
  const allNeeds = useMemo(
    () => needsFor({ tickets, quotes, meetings, tasks, deals, leads, campaigns, accounts, users, settings }, meUser, scope, now),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tickets, quotes, meetings, tasks, deals, leads, campaigns, scope, now, me],
  );
  const needs = notSnoozed(allNeeds, snoozed, now);
  const month = useMemo(() => monthSeries(deals, scope, me, now), [deals, scope, me, now]);
  const scopedDeals = mine(deals);
  const scopedLeads = mine(leads);
  const scopedTasks = mine(tasks);
  const scopedTickets = mine(tickets);
  const openDeals = scopedDeals.filter((d) => stageKind(d.stage) === 'open');
  const wonDeals = scopedDeals.filter((d) => stageKind(d.stage) === 'won');
  const leadPair = periodPair(scopedLeads, days, (l) => Date.parse(l.createdAt), () => 1, now);
  const addedPair = periodPair(scopedDeals, days, (d) => Date.parse(d.createdAt), (d) => d.amount || 0, now);
  const wonPair = periodPair(wonDeals, days, (d) => Date.parse(d.closeDate), (d) => d.amount || 0, now);
  const today = startOfDay(now);
  const openTasks = scopedTasks.filter((t) => !t.completed);
  const dueToday = openTasks.filter((t) => startOfDay(Date.parse(t.dueDate)) === today);
  const overdue = openTasks.filter((t) => startOfDay(Date.parse(t.dueDate)) < today);
  const openTickets = scopedTickets.filter(isOpenTicket);
  const withCustomer = mine(quotes).filter((q) => q.status === 'Sent');
  const approvals = allNeeds.filter((n) => n.kind === 'approval').length;
  const tiles: PulseTile[] = [
    { testId: 'stat-leads', label: 'New leads', value: String(leadPair.current), note: <Delta change={leadPair.change} />, to: `/leads?created=${days}d`, hue: '#2f6fe0',
      series: buckets(scopedLeads, days, (l) => Date.parse(l.createdAt), () => 1, now) },
    { testId: 'stat-pipeline', label: 'Open pipeline', value: moneyShort(openDeals.reduce((t, d) => t + (d.amount || 0), 0)),
      note: <span className="db-d flat">{plural(openDeals.length, 'open deal')} · {moneyShort(addedPair.current)} added</span>, to: '/deals?stage=open', hue: '#7a4fd6',
      series: buckets(scopedDeals, days, (d) => Date.parse(d.createdAt), (d) => d.amount || 0, now) },
    { testId: 'stat-won', label: 'Won', value: moneyShort(wonPair.current), note: <Delta change={wonPair.change} />, to: '/deals', hue: '#1f9d63',
      series: buckets(wonDeals, days, (d) => Date.parse(d.closeDate), (d) => d.amount || 0, now) },
    { testId: 'stat-tasks', label: 'Tasks due today', value: String(dueToday.length), flag: overdue.length > 0,
      note: overdue.length ? <span className="db-d down">{overdue.length} overdue</span> : <span className="db-d flat">Nothing overdue</span>, to: '/tasks?due=today', hue: '#c98a12',
      series: buckets(scopedTasks, days, (t) => Date.parse(t.dueDate), () => 1, now) },
    { testId: 'stat-tickets', label: 'Open tickets', value: String(openTickets.length), flag: nearBreach(openTickets, now) > 0,
      note: nearBreach(openTickets, now) ? <span className="db-d down">{nearBreach(openTickets, now)} close to or past the SLA</span> : <span className="db-d flat">All within the SLA</span>,
      to: '/tickets?status=open', hue: '#d33a3a', series: buckets(scopedTickets, days, (t) => Date.parse(t.createdAt), () => 1, now) },
    { testId: 'stat-quotes', label: 'Quotes with customers', value: String(withCustomer.length),
      note: approvals ? <span className="db-d down">{plural(approvals, 'discount')} waiting for you</span> : <span className="db-d flat">No approvals waiting</span>,
      to: '/quotes', hue: '#0f97a8', series: buckets(mine(quotes), days, (q) => Date.parse(q.createdAt), () => 1, now) },
  ];
  const day = dayAgenda(meetings, tasks, scope === 'mine' ? me : undefined, now);
  const stages = bankStages();
  const river = stageRiver(scopedDeals, stages);
  const outcome = monthOutcome(scopedDeals, now);
  const leadStatuses = [...new Set([...getStatusOptions('leads', 'status', LEAD_STATUSES), ...scopedLeads.map((l) => l.status)])];
  const rangedLeads = scopedLeads.filter((l) => Date.parse(l.createdAt) >= now - days * DAY);
  const leadRows = leadStatuses.map((s, i) => ({ name: s, hue: LEAD_HUES[i % LEAD_HUES.length], count: rangedLeads.filter((l) => l.status === s).length })).filter((r) => r.count > 0);
  const team = teamRows(users, deals, tasks, tickets, now);
  const fresh = !loading && leads.length === 0 && deals.length === 0 && accounts.length === 0;

  // ---------- actions ----------
  const snooze = (item: NeedItem) => {
    const next = Object.fromEntries(Object.entries(snoozed).filter(([, until]) => until > Date.now()));
    next[item.key] = Date.now() + SNOOZE_MS;
    setSnoozed(next);
    write(`crm.dashSnooze.${me ?? ''}`, next);
    toast.push('info', 'Snoozed for two hours.');
  };
  const done = async (item: NeedItem) => {
    const task = tasks.find((t) => t.id === item.taskId);
    if (!task) return;
    try {
      const saved = await upsert<TaskItem>('tasks', { ...task, completed: true });
      setTasks((list) => list.map((t) => (t.id === saved.id ? saved : t)));
      toast.push('success', 'Task done.');
    } catch {
      toast.push('error', 'The task couldn’t be saved. Check your connection and try again.');
    }
  };
  const pickScope = (s: Scope) => { setScope(s); write('crm.dashScope', s); };
  const pickRange = (r: string) => { setRange(r); write('crm.dashRange', r); };

  // ---------- customise ----------
  const layoutJson = JSON.stringify(cards);
  const finishEdit = async () => {
    setEdit(false);
    if (layoutJson === savedJson) return;
    try {
      await apiFetch('/dashboard/layout', { method: 'PUT', body: JSON.stringify({ cards }) });
      setSavedJson(layoutJson);
      toast.push('success', 'Layout saved. It follows you to every device.');
    } catch {
      toast.push('error', 'The layout couldn’t be saved. It stays as it is until you reload.');
    }
  };
  const resetLayout = async () => {
    const next = cleanLayout(bankLayout?.cards);
    setCards(next);
    try {
      await apiFetch('/dashboard/layout', { method: 'DELETE' });
      setSavedJson(JSON.stringify(next));
      toast.push('success', bankLayout ? 'Back to the bank’s layout.' : 'Back to the standard layout.');
    } catch {
      toast.push('error', 'The reset couldn’t be saved. Try again.');
    }
  };
  const makeBankLayout = async () => {
    try {
      const saved = await apiFetch<DashboardLayout>('/dashboard/layout/bank', { method: 'PUT', body: JSON.stringify({ cards }) });
      setBankLayout(saved);
      toast.push('success', 'Saved as the layout everyone starts with. People who arranged their own keep theirs.');
    } catch {
      toast.push('error', 'The bank layout couldn’t be saved. Try again.');
    }
  };
  const setCard = (id: string, patch: Partial<DashboardCard>) => setCards((list) => list.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const onAuto = useCallback((id: string, rows: number) => setAuto((a) => (a[id] === rows ? a : { ...a, [id]: rows })), []);
  const narrowGrid = gridWidth > 0 && gridWidth <= 720;
  const bands = bandRows(cards, auto, narrowGrid);
  const rowsOf = (c: DashboardCard) => bands[c.id] ?? c.rows ?? Math.max(CARD_MIN[c.id as CardId]?.[1] ?? 1, auto[c.id] ?? 1);
  const colStep = gridWidth > 0 ? (gridWidth - 11 * 14) / 12 + 14 : 80;

  // Pointer drags: moving a whole card, or sizing it from an edge or the corner. Window listeners keep the drag
  // alive while the card re-renders under the pointer.
  const drag = useRef<{ mode: 'move' | 'size'; id: string; dir?: 'e' | 's' | 'se'; x0: number; y0: number; span0: number; rows0: number } | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      if (d.mode === 'size') {
        setCards((list) => list.map((c) => {
          if (c.id !== d.id) return c;
          const next = resized(c, d.dir!, narrowGrid ? 0 : e.clientX - d.x0, e.clientY - d.y0, colStep, d.span0, d.rows0);
          return d.dir === 'e' ? { ...next, rows: c.rows } : next;
        }));
        return;
      }
      const over = document.elementsFromPoint(e.clientX, e.clientY).map((el) => (el as HTMLElement).closest?.('[data-card]') as HTMLElement | null).find((el) => el && el.dataset.card !== d.id);
      if (!over) return;
      const r = over.getBoundingClientRect();
      const after = e.clientY > r.top + r.height / 2 || (e.clientX > r.left + r.width / 2 && e.clientY > r.top + r.height * 0.25);
      setCards((list) => {
        const next = moveCard(list, d.id, over.dataset.card!, after);
        return next.map((c) => c.id).join() === list.map((c) => c.id).join() ? list : next;
      });
    };
    const up = () => { if (drag.current) { drag.current = null; setDragId(null); document.body.classList.remove('db-dragging'); } };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); };
  }, [colStep, narrowGrid]);

  const startMove = (c: DashboardCard) => (e: ReactPointerEvent) => {
    if (!edit || (e.target as HTMLElement).closest('button, a, input, [data-rz]')) return;
    e.preventDefault();
    drag.current = { mode: 'move', id: c.id, x0: e.clientX, y0: e.clientY, span0: c.span, rows0: rowsOf(c) };
    setDragId(c.id);
    document.body.classList.add('db-dragging');
  };
  const startSize = (c: DashboardCard, dir: 'e' | 's' | 'se') => (e: ReactPointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    drag.current = { mode: 'size', id: c.id, dir, x0: e.clientX, y0: e.clientY, span0: c.span, rows0: rowsOf(c) };
    setDragId(c.id);
    document.body.classList.add('db-dragging');
  };
  const sizeKeys = (c: DashboardCard) => (e: ReactKeyboardEvent) => {
    const [minC, minR] = CARD_MIN[c.id as CardId] ?? [1, 1];
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); setCard(c.id, { span: Math.max(minC, Math.min(12, c.span + (e.key === 'ArrowRight' ? 1 : -1))) }); }
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); setCard(c.id, { rows: Math.max(minR, Math.min(80, rowsOf(c) + (e.key === 'ArrowDown' ? 1 : -1))) }); }
  };
  const moveKeys = (c: DashboardCard) => (e: ReactKeyboardEvent) => {
    const i = cards.findIndex((x) => x.id === c.id);
    const visible = cards.filter((x) => !x.hidden);
    const vi = visible.findIndex((x) => x.id === c.id);
    if ((e.key === 'ArrowUp' || e.key === 'ArrowLeft') && vi > 0) { e.preventDefault(); setCards(moveCard(cards, c.id, visible[vi - 1].id, false)); }
    if ((e.key === 'ArrowDown' || e.key === 'ArrowRight') && vi < visible.length - 1 && i >= 0) { e.preventDefault(); setCards(moveCard(cards, c.id, visible[vi + 1].id, true)); }
  };

  // ---------- page ----------
  const allFailed = failed.length === DATA_KEYS.length;
  const hour = new Date(now).getHours();
  const first = user?.name?.split(' ')[0] ?? '';
  const n = needs.length;
  const change = month.lastAtToday ? Math.round((month.won / month.lastAtToday - 1) * 100) : null;
  const summary = fresh
    ? 'Welcome. Start with the steps in Get your bank going; the rest of this page fills in as your team works.'
    : (
      <>
        <b>{n ? `${plural(n, 'thing')} need${n === 1 ? 's' : ''} you` : 'Nothing needs you'}</b>
        {n > 0 && needs[0].rank < 60 * 60_000 ? ', the first within the hour' : ''}. {month.monthName} is at <b>{money(month.won)}</b> won
        {change !== null ? `, ${Math.abs(change)}% ${change >= 0 ? 'ahead of' : 'behind'} last month at this point.` : '.'}
      </>
    );

  const controls = (c: DashboardCard) => edit && (
    <span className="db-ctl">
      <span className="db-sz" title="Width in columns of 12, height in rows">{narrowGrid ? 'Full width' : `${c.span}/12`} · {rowsOf(c)} rows</span>
      <button type="button" disabled={c.rows === null} onClick={() => setCard(c.id, { rows: null })} title="Make the height follow the content">Fit</button>
      <button type="button" onClick={() => setCard(c.id, { hidden: true })} aria-label={`Hide ${CARD_TITLES[c.id as CardId]}`} data-testid={`dash-hide-${c.id}`}><EyeOff size={14} aria-hidden="true" /></button>
      <span className="db-hdl" tabIndex={0} role="button" aria-label={`Move ${CARD_TITLES[c.id as CardId]}: arrow keys move it earlier or later`} onKeyDown={moveKeys(c)}><GripVertical size={16} aria-hidden="true" /></span>
    </span>
  );

  const body = (c: DashboardCard): ReactNode => {
    switch (c.id as CardId) {
      case 'needs':
        return fresh ? (
          <GetStarted controls={controls(c)} steps={[
            { title: 'Add your first lead', sub: 'Or import a list from Excel', to: '/leads/new', done: leads.length > 0 },
            { title: 'Invite your team', sub: 'Relationship managers, branch and service staff', to: '/setup/users', done: users.filter((u) => u.active !== false).length > 1 },
            { title: 'Set your deal stages', sub: 'Setup, then Status codes', to: '/setup/status-codes', done: deals.length > 0 },
            { title: 'Bring in your customers', sub: 'Import accounts and contacts in one go', to: '/setup/import', done: accounts.length > 0 },
          ]} />
        ) : (
          <NeedsCard items={needs} users={users} showOwner={scope === 'bank'} canAct={canWrite} onDone={done} onSnooze={snooze} controls={controls(c)} />
        );
      case 'month':
        return (
          <>
            <CardHead title="Month so far" sub={`${month.monthName} · day ${month.today} of ${month.days}`}>{controls(c)}</CardHead>
            {isFailed('deals') ? <div className="db-wb"><Unavailable what="deals" onRetry={retryOne('deals')} /></div> : <MonthBlock month={month} />}
          </>
        );
      case 'pulse':
        return (
          <>
            {edit && <div className="db-wh db-wh-bare"><h2>Pulse</h2><span className="db-muted db-sub">{rangeLabel}</span>{controls(c)}</div>}
            <PulseCard tiles={tiles} />
          </>
        );
      case 'day':
        return (
          <>
            <CardHead title="Your day" sub={new Date(now).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}>{controls(c)}</CardHead>
            <div className="db-wb">
              {isFailed('meetings') ? <Unavailable what="meetings" onRetry={retryOne('meetings')} /> : <DayList items={day.items} nowIndex={day.nowIndex} untimed={day.untimed} now={now} />}
            </div>
          </>
        );
      case 'pipe':
        return (
          <>
            <CardHead title="Deals by stage" sub={`${moneyShort(river.total)} open · ${moneyShort(river.weighted)} weighted`}>{controls(c)}</CardHead>
            <div className="db-wb">
              {isFailed('deals') ? <Unavailable what="deals" onRetry={retryOne('deals')} /> : river.rows.length === 0 ? (
                <div className="db-empty-s"><b>No open deals</b>Open deals show here by stage, sized by value.</div>
              ) : (
                <>
                  <River rows={river.rows} picked={stage} onPick={(s) => setStage(stage === s ? null : s)} />
                  <div className="db-rv-keys">
                    {river.rows.map((r) => <div key={r.name}><b style={{ '--c': r.hue } as CSSProperties}><i />{r.name}</b>{plural(r.count, 'deal')} · {moneyShort(r.value)}</div>)}
                  </div>
                  <div className="db-lab db-mt">Closing soonest{stage ? ` · ${stage}` : ''}</div>
                  <ClosingList deals={river.closing.filter((d) => !stage || d.stage === stage).slice(0, 3)} accountName={accountName} />
                  <div className="db-rv-out">
                    <span>Won this month <b>{moneyShort(outcome.won)}</b> from {plural(outcome.wonCount, 'deal')}</span>
                    <span>Lost <b>{moneyShort(outcome.lost)}</b>{outcome.topReason ? ` · mostly “${outcome.topReason}”` : ''}</span>
                  </div>
                </>
              )}
            </div>
          </>
        );
      case 'team':
        return (
          <>
            <CardHead title="Team this month" sub="Everyone who sells or serves">{controls(c)}</CardHead>
            <div className="db-wb">{team.length ? <TeamTable rows={team} me={me} /> : <div className="db-empty-s"><b>Just you so far</b>Invite your team in Setup, then Users.</div>}</div>
          </>
        );
      case 'leads':
        return (
          <>
            <CardHead title="Leads by status" sub={`${rangedLeads.length} new in the ${rangeLabel.toLowerCase()}`}>{controls(c)}</CardHead>
            <div className="db-wb">
              {isFailed('leads') ? <Unavailable what="leads" onRetry={retryOne('leads')} /> : leadRows.length === 0 ? (
                <div className="db-empty-s"><b>No new leads</b>Each square will be one percent of your new leads.</div>
              ) : (
                <Waffle squares={waffle(leadRows.map((r) => ({ name: r.name, count: r.count })))} keyRows={leadRows} focus={leadFocus} onFocus={(s) => setLeadFocus(leadFocus === s ? null : s)} />
              )}
            </div>
          </>
        );
      case 'feed':
        return (
          <>
            <CardHead title="Recent activity">
              <Link to="/activity" className="db-link" data-testid="activity-view-all" aria-label="View all activity">View all</Link>
              {controls(c)}
            </CardHead>
            <div className="db-wb">{isFailed('activities') ? <Unavailable what="activities" onRetry={retryOne('activities')} /> : <Feed activities={activities} />}</div>
          </>
        );
      default:
        return null;
    }
  };

  const hidden = cards.filter((c) => c.hidden);
  return (
    <div className="db3" data-testid="dashboard-page">
      <div className="db-brief">
        <div className="t">
          <span className="db-lab" data-testid="dashboard-identity">
            {new Date(now).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })} · {bankName}
          </span>
          <h1>Good {hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'}{first ? `, ${first}` : ''}</h1>
          {!loading && !allFailed && <p data-testid="dashboard-summary">{summary}</p>}
        </div>
        <div className="acts">
          {user?.role !== 'viewer' && (
            <div className="tk-seg db-scope" role="group" aria-label="Whose numbers">
              <button type="button" aria-pressed={scope === 'mine'} data-testid="dashboard-scope-mine" onClick={() => pickScope('mine')}>My work</button>
              <button type="button" aria-pressed={scope === 'bank'} data-testid="dashboard-scope-bank" onClick={() => pickScope('bank')}>Whole bank</button>
            </div>
          )}
          <div className="db-range"><Select value={range} options={RANGES} onChange={pickRange} testId="dashboard-range" /></div>
          <button type="button" className={classNames('btn', edit && 'btn-primary contacts-primary')} data-testid="dashboard-customise" onClick={() => (edit ? finishEdit() : setEdit(true))}>
            <SlidersHorizontal size={15} aria-hidden="true" />{edit ? 'Done' : 'Customise'}
          </button>
        </div>
      </div>

      {edit && (
        <div className="db-edit" data-testid="dashboard-edit-bar">
          <span>Grab a card anywhere to move it. Drag its right edge, bottom edge or corner to make it any size; double-click the corner to fit the content. Saved for you on every device.</span>
          <button type="button" className="btn" onClick={resetLayout}>Reset to the {bankLayout ? 'bank’s' : 'standard'} layout</button>
          {user?.role === 'admin' && <button type="button" className="btn" onClick={makeBankLayout} data-testid="dashboard-bank-layout">Make this the bank’s layout</button>}
          {hidden.length > 0 && (
            <div className="db-tray"><span className="db-lab">Add back</span>
              {hidden.map((c) => <button key={c.id} type="button" className="db-add" onClick={() => setCard(c.id, { hidden: false })}><Plus size={12} aria-hidden="true" />{CARD_TITLES[c.id as CardId]}</button>)}
            </div>
          )}
        </div>
      )}

      {loading && !allFailed && failed.length === 0 && leads.length === 0 && deals.length === 0 ? (
        <div role="status" aria-label="Loading dashboard"><SkeletonRows rows={8} /></div>
      ) : allFailed ? (
        <div className="dash-error" role="alert" data-testid="dashboard-error">
          <h3>Dashboard didn’t load</h3>
          <p>We couldn’t reach the server, so no figures are shown. Your data is unchanged. Check your connection and try again.</p>
          <button type="button" ref={retryRef} className="btn btn-primary dash-retry" data-testid="dashboard-retry" aria-busy={loading} disabled={loading}
            onClick={() => { focusRetry.current = true; load(); }}>
            {loading ? 'Retrying…' : 'Retry'}
          </button>
        </div>
      ) : (
        <>
          {failed.length > 0 && (
            <div className="dash-unavailable-row">{failed.map((k) => <Unavailable key={k} what={k} onRetry={retryOne(k)} />)}</div>
          )}
          <div className={classNames('db-grid', edit && 'editing')} ref={gridRef}>
            {cards.filter((c) => !c.hidden).map((c, i) => (
              <CardFrame key={c.id} card={c} rows={rowsOf(c)} index={i} edit={edit} lifted={dragId === c.id} bare={c.id === 'pulse'} onAuto={onAuto}
                onPointerDown={startMove(c)} onSize={(dir) => startSize(c, dir)} onFit={() => setCard(c.id, { rows: null })} onSizeKeys={sizeKeys(c)}>
                {body(c)}
              </CardFrame>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function MonthBlock({ month }: { month: ReturnType<typeof monthSeries> }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  return (
    <div ref={ref}>
      <MonthFigures m={month} />
      <MonthChart m={month} narrow={width > 0 && width < 520} />
      <div className="db-legend"><span><i className="l1" />This month</span><span><i className="l2" />Last month</span><span><i className="l3" />Open deals closing this month, at their chance and in full</span></div>
    </div>
  );
}

interface FrameProps {
  card: DashboardCard;
  rows: number;
  index: number;
  edit: boolean;
  lifted: boolean;
  bare: boolean;
  onAuto: (id: string, rows: number) => void;
  onPointerDown: (e: ReactPointerEvent) => void;
  onSize: (dir: 'e' | 's' | 'se') => (e: ReactPointerEvent) => void;
  onFit: () => void;
  onSizeKeys: (e: ReactKeyboardEvent) => void;
  children: ReactNode;
}

/** One card on the grid. It measures its content so a card nobody has sized is exactly as tall as what it shows. */
function CardFrame({ card, rows, index, edit, lifted, bare, onAuto, onPointerDown, onSize, onFit, onSizeKeys, children }: FrameProps) {
  const inner = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = inner.current;
    if (!el) return;
    const report = () => onAuto(card.id, rowsForHeight(el.offsetHeight + (bare ? 0 : 2)));
    report();
    const ro = new ResizeObserver(report);
    ro.observe(el);
    return () => ro.disconnect();
  }, [card.id, bare, onAuto]);
  return (
    <section className={classNames('db-w', lifted && 'lift')} data-card={card.id} style={{ '--span': card.span, '--rows': rows, animationDelay: `${index * 50}ms` } as CSSProperties}
      onPointerDown={onPointerDown} aria-label={CARD_TITLES[card.id as CardId]}>
      <div className={classNames(bare ? 'db-bare' : 'db-card')}>
        <div className="db-wi" ref={inner}>{children}</div>
      </div>
      {edit && (
        <>
          <span className="db-rz e" data-rz="e" onPointerDown={onSize('e')} title="Drag to change the width" />
          <span className="db-rz s" data-rz="s" onPointerDown={onSize('s')} title="Drag to change the height" />
          <span className="db-rz se" data-rz="se" tabIndex={0} role="button" aria-label="Resize: arrow keys change width and height, double-click fits the content"
            onPointerDown={onSize('se')} onDoubleClick={onFit} onKeyDown={onSizeKeys} title="Drag to resize. Double-click to fit the content" />
        </>
      )}
    </section>
  );
}
