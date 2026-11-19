import { Campaign, DashboardCard, Deal, Lead, Meeting, Quote, QuoteSettings, TaskItem, Ticket, User } from '../../types';
import { stageKind, StageInfo } from '../deals/dealLogic';
import { isOpenTicket, leftMs, slaState, ticketRef, usedShare } from '../tickets/ticketLogic';
import { needsApproval } from '../quotes/quoteMath';
import { statsFor, expectedSpend } from '../campaigns/campaignLogic';

export const DAY = 86_400_000;
const HOUR = 3_600_000;
const MIN = 60_000;
export const startOfDay = (ms: number) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };

// ---------- whose numbers ----------
export type Scope = 'mine' | 'bank';
/** A record counts as mine when I own it; records with no owner count for everyone. */
export const inScope = (scope: Scope, me: string | undefined, ownerId?: string | null) => scope === 'bank' || !ownerId || ownerId === me;
/** Reps start on their own work; admins and viewers start on the whole bank. */
export const defaultScope = (role: string | undefined): Scope => (role === 'rep' ? 'mine' : 'bank');

// ---------- needs you ----------
export type NeedKind = 'ticket' | 'approval' | 'meeting' | 'task' | 'deal' | 'campaign';
export const NEED_KINDS: Record<NeedKind, { label: string; hue: string }> = {
  ticket: { label: 'Ticket', hue: '#d33a3a' },
  approval: { label: 'Approval', hue: '#7a4fd6' },
  meeting: { label: 'Meeting', hue: '#0f97a8' },
  task: { label: 'Task', hue: '#c98a12' },
  deal: { label: 'Deal', hue: '#2f6fe0' },
  campaign: { label: 'Campaign', hue: '#d9467a' },
};

export interface NeedItem {
  /** Stable per record and reason, so a snooze sticks to it. */
  key: string;
  kind: NeedKind;
  title: string;
  sub: string;
  why: string;
  /** True when the reason is already late (shown in red). */
  hot: boolean;
  /** 0 to 1, how much of the time is used, when there is a clock. */
  fuse: number | null;
  ownerId: string | null;
  href: string;
  action: string;
  /** Lower comes first. */
  rank: number;
  taskId?: string;
}

export interface NeedsInput {
  tickets: Ticket[];
  quotes: Quote[];
  meetings: Meeting[];
  tasks: TaskItem[];
  deals: Deal[];
  leads: Lead[];
  campaigns: Campaign[];
  accounts: { id: string; name: string }[];
  users: User[];
  settings: QuoteSettings;
}

export function spanWords(ms: number): string {
  const m = Math.max(0, Math.round(Math.abs(ms) / MIN));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h} h${m % 60 && h < 10 ? ` ${m % 60} min` : ''}`;
  return `${Math.floor(h / 24)} days`;
}
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
const daysBetween = (fromMs: number, toMs: number) => Math.round((startOfDay(toMs) - startOfDay(fromMs)) / DAY);

/** Everything that wants a person's attention now, most urgent first. */
export function needsFor(input: NeedsInput, me: User | null, scope: Scope, now = Date.now()): NeedItem[] {
  const mine = (owner?: string | null) => inScope(scope, me?.id, owner);
  const nameOf = (id?: string | null) => input.users.find((u) => u.id === id)?.name ?? '';
  const account = (id?: string | null) => input.accounts.find((a) => a.id === id)?.name ?? '';
  const out: NeedItem[] = [];

  // Tickets that breach within four hours, or already have. Paused ones wait on the customer.
  for (const t of input.tickets) {
    if (!isOpenTicket(t) || t.pausedAt || !mine(t.ownerId)) continue;
    const left = leftMs(t, now);
    if (!Number.isFinite(left) || left > 4 * HOUR) continue;
    out.push({
      key: `ticket:${t.id}`, kind: 'ticket', title: t.subject, sub: [ticketRef(t), t.requester, `Priority ${t.priority}`].filter(Boolean).join(' · '),
      why: left < 0 ? `SLA breached ${spanWords(left)} ago` : `SLA breaches in ${spanWords(left)}`, hot: left < HOUR, fuse: usedShare(t, now),
      ownerId: t.ownerId ?? null, href: `/tickets/${t.id}`, action: 'Open ticket', rank: left,
    });
  }

  // Discounts waiting for this person's approval.
  const approver = !!me && (me.role === 'admin' || (!!input.settings.approverId && me.id === input.settings.approverId));
  if (approver) {
    for (const q of input.quotes) {
      if (q.status !== 'Draft' || q.approval !== 'waiting' || !needsApproval(q, input.settings.discountLimit)) continue;
      const top = Math.max(...q.lineItems.map((l) => l.discountPct || 0));
      out.push({
        key: `approval:${q.id}`, kind: 'approval', title: `Quote ${q.quoteNumber} asks ${top}% off`, sub: account(q.accountId),
        why: `Above the ${input.settings.discountLimit}% limit${nameOf(q.ownerId) ? `. ${nameOf(q.ownerId)} is waiting` : ''}`, hot: false, fuse: null,
        ownerId: q.ownerId ?? null, href: `/quotes/${q.id}`, action: 'Review', rank: 90 * MIN,
      });
    }
  }

  // Meetings in the next three hours that have no agenda.
  for (const m of input.meetings) {
    const until = Date.parse(m.start) - now;
    if (!(until > 0 && until <= 3 * HOUR) || (m.notes ?? '').trim()) continue;
    if (scope === 'mine' && me && m.ownerId !== me.id && !(m.attendeeIds ?? []).includes(me.id)) continue;
    out.push({
      key: `meeting:${m.id}`, kind: 'meeting', title: m.title, sub: [m.type, m.location].filter(Boolean).join(' · '),
      why: `Starts in ${spanWords(until)}, no agenda yet`, hot: until < 30 * MIN, fuse: 1 - until / (3 * HOUR),
      ownerId: m.ownerId, href: `/calendar/${m.id}/edit`, action: 'Add agenda', rank: until,
    });
  }

  // Overdue tasks.
  for (const t of input.tasks) {
    if (t.completed || !mine(t.ownerId)) continue;
    const late = daysBetween(Date.parse(t.dueDate), now);
    if (!(late > 0)) continue;
    out.push({
      key: `task:${t.id}`, kind: 'task', title: t.title, sub: `Priority ${t.priority}`, why: `${plural(late, 'day')} overdue`, hot: true, fuse: null,
      ownerId: t.ownerId ?? null, href: `/tasks/${t.id}/edit`, action: 'Mark done', rank: 4 * HOUR - Math.min(late, 3) * HOUR, taskId: t.id,
    });
  }

  // Deals closing within two weeks with no next step.
  for (const d of input.deals) {
    if (stageKind(d.stage) !== 'open' || (d.nextStep ?? '').trim() || !mine(d.ownerId)) continue;
    const days = daysBetween(now, Date.parse(d.closeDate));
    if (!(days <= 14)) continue;
    out.push({
      key: `deal:${d.id}`, kind: 'deal', title: `${d.name} has no next step`, sub: [account(d.accountId), d.stage].filter(Boolean).join(' · '),
      why: days < 0 ? `Close date passed ${plural(-days, 'day')} ago` : days === 0 ? 'Closes today, nothing planned' : `Closes in ${plural(days, 'day')}, nothing planned`,
      hot: days <= 1, fuse: null, ownerId: d.ownerId ?? null, href: `/deals/${d.id}`, action: 'Add next step', rank: 6 * HOUR + Math.max(days, 0) * 6 * HOUR,
    });
  }

  // Running campaigns spending well ahead of the plan.
  for (const c of input.campaigns) {
    if (c.status !== 'Active' || !c.budget || !mine(c.ownerId)) continue;
    const spent = statsFor(c, input.leads, input.deals).spent / c.budget;
    const expect = expectedSpend(c, now);
    if (spent - expect < 0.25) continue;
    out.push({
      key: `campaign:${c.id}`, kind: 'campaign', title: `${c.name} is spending ahead of plan`, sub: c.channel,
      why: `${Math.round(spent * 100)}% of the budget gone at ${Math.round(expect * 100)}% of the run`, hot: spent >= 1, fuse: Math.min(1, spent),
      ownerId: c.ownerId ?? null, href: `/campaigns/${c.id}`, action: 'Open campaign', rank: 48 * HOUR,
    });
  }

  return out.sort((a, b) => a.rank - b.rank);
}

/** Drops items whose snooze has not run out. */
export const notSnoozed = (items: NeedItem[], snoozed: Record<string, number>, now = Date.now()) => items.filter((i) => !(snoozed[i.key] > now));
/** Snoozing hides an item for two hours. */
export const SNOOZE_MS = 2 * HOUR;

// ---------- month so far ----------
export interface MonthSeries {
  /** Won to date by day of this month, up to today. */
  thisMonth: number[];
  /** Won to date by day of last month, every day. */
  lastMonth: number[];
  today: number;
  days: number;
  won: number;
  wonDeals: number;
  /** Won by the same day last month. */
  lastAtToday: number;
  /** What open deals closing this month add, at their chance and in full. */
  expected: number;
  best: number;
  monthName: string;
}

export function monthSeries(deals: Deal[], scope: Scope, me: string | undefined, now = Date.now()): MonthSeries {
  const d = new Date(now);
  const y = d.getFullYear();
  const m = d.getMonth();
  const days = new Date(y, m + 1, 0).getDate();
  const lastDays = new Date(y, m, 0).getDate();
  const today = d.getDate();
  const own = deals.filter((x) => inScope(scope, me, x.ownerId));
  const won = own.filter((x) => stageKind(x.stage) === 'won');
  const cumulate = (year: number, month: number, len: number, upTo: number) => {
    const daily = Array.from({ length: len }, () => 0);
    for (const x of won) {
      const c = new Date(x.closeDate);
      if (c.getFullYear() === year && c.getMonth() === month && c.getDate() <= upTo) daily[c.getDate() - 1] += x.amount || 0;
    }
    let run = 0;
    return daily.map((v) => (run += v));
  };
  const thisMonth = cumulate(y, m, days, today).slice(0, today);
  const lm = new Date(y, m - 1, 1);
  const lastMonth = cumulate(lm.getFullYear(), lm.getMonth(), lastDays, lastDays);
  const monthEnd = new Date(y, m, days, 23, 59, 59).getTime();
  const openThisMonth = own.filter((x) => stageKind(x.stage) === 'open' && Date.parse(x.closeDate) <= monthEnd && Date.parse(x.closeDate) >= startOfDay(now));
  const wonNow = thisMonth[today - 1] ?? 0;
  return {
    thisMonth,
    lastMonth,
    today,
    days,
    won: wonNow,
    wonDeals: won.filter((x) => { const c = new Date(x.closeDate); return c.getFullYear() === y && c.getMonth() === m && c.getDate() <= today; }).length,
    lastAtToday: lastMonth[Math.min(today, lastDays) - 1] ?? 0,
    expected: wonNow + openThisMonth.reduce((t, x) => t + ((x.amount || 0) * (x.probability || 0)) / 100, 0),
    best: wonNow + openThisMonth.reduce((t, x) => t + (x.amount || 0), 0),
    monthName: d.toLocaleDateString('en-GB', { month: 'long' }),
  };
}

/** A round step for an axis that should show about four lines up to `max`. */
export function niceStep(max: number): number {
  const raw = Math.max(max, 1) / 4;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}

// ---------- pulse ----------
export const RANGES = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: '365', label: 'Last year' },
];

/** Splits the last `days` days into buckets (daily for a week, otherwise 12) and sums `value` of each item in its bucket. */
export function buckets<T>(items: T[], days: number, at: (item: T) => number, value: (item: T) => number = () => 1, now = Date.now()): number[] {
  const n = days <= 7 ? days : 12;
  const end = now;
  const start = end - days * DAY;
  const size = (end - start) / n;
  const out = Array.from({ length: n }, () => 0);
  for (const item of items) {
    const t = at(item);
    if (!(t >= start && t <= end)) continue;
    out[Math.min(n - 1, Math.floor((t - start) / size))] += value(item);
  }
  return out;
}

/** Sum of `value` for items dated in the last `days` days, and in the same length of time before that. */
export function periodPair<T>(items: T[], days: number, at: (item: T) => number, value: (item: T) => number = () => 1, now = Date.now()) {
  let current = 0;
  let previous = 0;
  for (const item of items) {
    const t = at(item);
    if (t > now) continue;
    if (t >= now - days * DAY) current += value(item);
    else if (t >= now - 2 * days * DAY) previous += value(item);
  }
  return { current, previous, change: previous ? (current - previous) / previous : null };
}

export const nearBreach = (tickets: Ticket[], now = Date.now()) => tickets.filter((t) => ['hot', 'breach'].includes(slaState(t, now))).length;

// ---------- your day ----------
export interface DayItem { key: string; at: number; time: string; title: string; sub: string; hue: string; href: string; kind: 'meeting' | 'task' }

export function dayAgenda(meetings: Meeting[], tasks: TaskItem[], me: string | undefined, now = Date.now()) {
  const from = startOfDay(now);
  const to = from + DAY;
  const hhmm = (ms: number) => new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const items: DayItem[] = [];
  for (const m of meetings) {
    const at = Date.parse(m.start);
    if (!(at >= from && at < to) || (me && m.ownerId !== me && !(m.attendeeIds ?? []).includes(me))) continue;
    items.push({ key: `m-${m.id}`, at, time: hhmm(at), title: m.title, sub: [m.type, `${m.durationMin} min`, m.location].filter(Boolean).join(' · '), hue: '#0f97a8', href: `/calendar/${m.id}/edit`, kind: 'meeting' });
  }
  let untimed = 0;
  for (const t of tasks) {
    if (t.completed || (me && t.ownerId && t.ownerId !== me)) continue;
    const due = startOfDay(Date.parse(t.dueDate));
    if (due !== from) continue;
    if (!t.dueTime) { untimed += 1; continue; }
    const [h, mi] = t.dueTime.split(':').map(Number);
    const at = from + h * HOUR + mi * MIN;
    items.push({ key: `t-${t.id}`, at, time: t.dueTime, title: t.title, sub: `Task · ${t.priority}`, hue: '#c98a12', href: `/tasks/${t.id}/edit`, kind: 'task' });
  }
  items.sort((a, b) => a.at - b.at);
  const nextAt = items.findIndex((i) => i.at >= now);
  return { items, untimed, nowIndex: nextAt < 0 ? items.length : nextAt };
}

// ---------- deals ----------
export function stageRiver(deals: Deal[], stages: StageInfo[]) {
  const open = stages.filter((s) => s.kind === 'open');
  const known = new Set(open.map((s) => s.name));
  const rows = open.map((s) => {
    const list = deals.filter((d) => d.stage === s.name);
    return { name: s.name, hue: s.hue, count: list.length, value: list.reduce((t, d) => t + (d.amount || 0), 0) };
  });
  // Deals in a stage the bank has since removed still count, under their own name.
  const extra = deals.filter((d) => stageKind(d.stage) === 'open' && !known.has(d.stage));
  for (const name of [...new Set(extra.map((d) => d.stage))]) {
    const list = extra.filter((d) => d.stage === name);
    rows.push({ name, hue: '#8a93a6', count: list.length, value: list.reduce((t, d) => t + (d.amount || 0), 0) });
  }
  const openDeals = deals.filter((d) => stageKind(d.stage) === 'open');
  return {
    rows: rows.filter((r) => r.count > 0),
    total: openDeals.reduce((t, d) => t + (d.amount || 0), 0),
    weighted: openDeals.reduce((t, d) => t + ((d.amount || 0) * (d.probability || 0)) / 100, 0),
    closing: [...openDeals].sort((a, b) => Date.parse(a.closeDate) - Date.parse(b.closeDate)),
  };
}

/** Deals won and lost in this calendar month, and the commonest reason for losing. */
export function monthOutcome(deals: Deal[], now = Date.now()) {
  const d = new Date(now);
  const inMonth = (x: Deal) => { const c = new Date(x.closeDate); return c.getFullYear() === d.getFullYear() && c.getMonth() === d.getMonth() && c.getTime() <= now; };
  const won = deals.filter((x) => stageKind(x.stage) === 'won' && inMonth(x));
  const lost = deals.filter((x) => stageKind(x.stage) === 'lost' && inMonth(x));
  const reasons = new Map<string, number>();
  for (const x of lost) if (x.lostReason) reasons.set(x.lostReason, (reasons.get(x.lostReason) ?? 0) + 1);
  const topReason = [...reasons.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
  return { won: won.reduce((t, x) => t + (x.amount || 0), 0), wonCount: won.length, lost: lost.reduce((t, x) => t + (x.amount || 0), 0), lostCount: lost.length, topReason };
}

// ---------- leads ----------
/** 100 squares split by status share (largest remainders), in the bank's status order. */
export function waffle(counts: { name: string; count: number }[]): string[] {
  const total = counts.reduce((t, c) => t + c.count, 0);
  if (!total) return [];
  const raw = counts.map((c) => ({ name: c.name, exact: (c.count / total) * 100 }));
  const base = raw.map((r) => ({ ...r, n: Math.floor(r.exact) }));
  let left = 100 - base.reduce((t, r) => t + r.n, 0);
  for (const r of [...base].sort((a, b) => (b.exact - b.n) - (a.exact - a.n))) { if (left <= 0) break; r.n += 1; left -= 1; }
  return base.flatMap((r) => Array.from({ length: r.n }, () => r.name));
}

// ---------- team ----------
export interface TeamRow { id: string; name: string; won: number; open: number; tasks: number; solved: number }

export function teamRows(users: User[], deals: Deal[], tasks: TaskItem[], tickets: Ticket[], now = Date.now()): TeamRow[] {
  const d = new Date(now);
  const thisMonth = (iso?: string | null) => { if (!iso) return false; const c = new Date(iso); return c.getFullYear() === d.getFullYear() && c.getMonth() === d.getMonth() && c.getTime() <= now; };
  return users
    .filter((u) => u.active !== false && u.role !== 'viewer')
    .map((u) => ({
      id: u.id,
      name: u.name,
      won: deals.filter((x) => x.ownerId === u.id && stageKind(x.stage) === 'won' && thisMonth(x.closeDate)).reduce((t, x) => t + (x.amount || 0), 0),
      open: deals.filter((x) => x.ownerId === u.id && stageKind(x.stage) === 'open').reduce((t, x) => t + (x.amount || 0), 0),
      tasks: tasks.filter((t) => t.ownerId === u.id && !t.completed).length,
      solved: tickets.filter((t) => t.ownerId === u.id && thisMonth(t.resolvedAt)).length,
    }))
    .sort((a, b) => b.won - a.won || b.open - a.open);
}

// ---------- layout ----------
export type CardId = 'needs' | 'month' | 'pulse' | 'day' | 'pipe' | 'team' | 'leads' | 'feed';
export const CARD_TITLES: Record<CardId, string> = {
  needs: 'Needs you', month: 'Month so far', pulse: 'Pulse', day: 'Your day', pipe: 'Deals by stage', team: 'Team this month', leads: 'Leads by status', feed: 'Recent activity',
};
/** Smallest size each card can take: [columns of 12, rows]. */
export const CARD_MIN: Record<CardId, [number, number]> = { needs: [4, 9], month: [4, 8], pulse: [6, 4], day: [3, 6], pipe: [4, 6], team: [5, 6], leads: [3, 7], feed: [4, 5] };
export const DEFAULT_CARDS: DashboardCard[] = [
  { id: 'needs', span: 5, rows: null, hidden: false },
  { id: 'month', span: 7, rows: null, hidden: false },
  { id: 'pulse', span: 12, rows: null, hidden: false },
  { id: 'day', span: 4, rows: null, hidden: false },
  { id: 'pipe', span: 8, rows: null, hidden: false },
  { id: 'team', span: 8, rows: null, hidden: false },
  { id: 'leads', span: 4, rows: null, hidden: false },
  { id: 'feed', span: 12, rows: null, hidden: false },
];
/** One row is 20px plus a 14px gap. */
export const ROW = 34;
export const GAP = 14;
export const rowsForHeight = (px: number) => Math.max(1, Math.ceil((px + GAP) / ROW));

const isCard = (id: string): id is CardId => id in CARD_TITLES;

/** A saved layout made safe: unknown cards dropped, sizes kept inside the grid and above each card's minimum, missing cards added at the end. */
export function cleanLayout(saved: DashboardCard[] | null | undefined): DashboardCard[] {
  if (!saved?.length) return DEFAULT_CARDS.map((c) => ({ ...c }));
  const seen = new Set<string>();
  const out: DashboardCard[] = [];
  for (const c of saved) {
    if (!isCard(c.id) || seen.has(c.id)) continue;
    seen.add(c.id);
    const [minC, minR] = CARD_MIN[c.id];
    out.push({ id: c.id, span: Math.max(minC, Math.min(12, Math.round(c.span) || 12)), rows: c.rows == null ? null : Math.max(minR, Math.min(80, Math.round(c.rows))), hidden: !!c.hidden });
  }
  for (const c of DEFAULT_CARDS) if (!seen.has(c.id)) out.push({ ...c });
  return out;
}

/** Moves one card to sit before (or after) another. */
export function moveCard(cards: DashboardCard[], id: string, targetId: string, after: boolean): DashboardCard[] {
  if (id === targetId) return cards;
  const item = cards.find((c) => c.id === id);
  if (!item) return cards;
  const rest = cards.filter((c) => c.id !== id);
  const at = rest.findIndex((c) => c.id === targetId);
  if (at < 0) return cards;
  const pos = at + (after ? 1 : 0);
  return [...rest.slice(0, pos), item, ...rest.slice(pos)];
}

/** New span and rows while a corner or edge is dragged by dx, dy pixels. */
export function resized(card: DashboardCard, dir: 'e' | 's' | 'se', dx: number, dy: number, colStep: number, startSpan: number, startRows: number): DashboardCard {
  const [minC, minR] = isCard(card.id) ? CARD_MIN[card.id] : [1, 1];
  const span = dir === 's' ? card.span : Math.max(minC, Math.min(12, startSpan + Math.round(dx / colStep)));
  if (dir === 'e') return { ...card, span };
  return { ...card, span, rows: Math.max(minR, Math.min(80, startRows + Math.round(dy / ROW))) };
}

/**
 * Rows for each visible card. Cards are laid out left to right in bands that fill 12 columns; a card nobody has
 * sized takes the tallest height in its band, so a row of cards ends evenly. On a narrow screen every card is its
 * own band.
 */
export function bandRows(cards: DashboardCard[], natural: Record<string, number>, narrow: boolean): Record<string, number> {
  const visible = cards.filter((c) => !c.hidden);
  const own = (c: DashboardCard) => c.rows ?? Math.max(isCard(c.id) ? CARD_MIN[c.id][1] : 1, natural[c.id] ?? 1);
  const out: Record<string, number> = {};
  let band: DashboardCard[] = [];
  let used = 0;
  const close = () => {
    const tallest = Math.max(1, ...band.map(own));
    for (const c of band) out[c.id] = c.rows ?? tallest;
    band = [];
    used = 0;
  };
  for (const c of visible) {
    const span = narrow ? 12 : c.span;
    if (used + span > 12 && band.length) close();
    band.push(c);
    used += span;
  }
  if (band.length) close();
  return out;
}
