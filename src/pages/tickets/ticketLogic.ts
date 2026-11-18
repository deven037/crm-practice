import { getAllSync } from '../../data/store';
import { SlaConfig, SlaRules, Ticket, TicketComment, TicketPriority, TicketStatus, TICKET_DONE, TICKET_TRANSITIONS, User } from '../../types';
import { getStatusOptions } from '../../utils/rules';
import { addSlaMinutes, policyFor, rulesOf } from './slaMath';

/* ---------- bank lists and settings ---------- */

export const DEFAULT_CHANNELS = ['Email', 'Phone', 'Branch', 'Portal', 'WhatsApp'];
export const DEFAULT_CATEGORIES = ['Payments', 'Cards', 'Net banking', 'Loans', 'Accounts', 'Deposits', 'Forex', 'KYC'];
export const DEFAULT_CANNED = [
  'Hello {first_name}, thank you for writing to us. I have taken this up and will update you within the hour.',
  'Hello {first_name}, could you share the transaction reference numbers and the date of the failed payments?',
  'Hello {first_name}, this has been fixed on our side. Please try again and tell us if anything still fails.',
];
export const ticketChannels = () => getStatusOptions('tickets', 'channel', DEFAULT_CHANNELS);
export const ticketCategories = () => getStatusOptions('tickets', 'category', DEFAULT_CATEGORIES);
export const cannedReplies = () => getStatusOptions('tickets', 'canned', DEFAULT_CANNED);
export const slaRulesNow = (): SlaRules => rulesOf(getAllSync<SlaRules>('slaRules'));
export const slaConfigsNow = (): SlaConfig[] => getAllSync<SlaConfig>('slaConfigs');

export const PRIORITY_ORDER: TicketPriority[] = ['Urgent', 'High', 'Medium', 'Low'];
export const PRIORITY_HUE: Record<TicketPriority, string> = { Urgent: '#d33a3a', High: '#e07b1a', Medium: '#c9a20e', Low: '#5b8def' };
export const PRIORITY_LEVEL: Record<TicketPriority, number> = { Urgent: 4, High: 3, Medium: 2, Low: 1 };
export const STATUS_HUE: Record<TicketStatus, string> = {
  New: '#2f6fe0', Open: '#0f97a8', 'In Progress': '#6d4fd6', 'Waiting on customer': '#c98a12', Resolved: '#1f9d63', Closed: '#8a93a6',
};
export const statusHue = (s: string) => STATUS_HUE[s as TicketStatus] ?? '#8a93a6';
export const priorityHue = (p: string) => PRIORITY_HUE[p as TicketPriority] ?? '#8a93a6';

export const canWriteTickets = (role: string | undefined) => role === 'admin' || role === 'rep';
export const staffOf = (users: User[]) => users.filter((u) => u.active !== false && (u.role === 'admin' || u.role === 'rep'));

/* ---------- time ---------- */

const MIN = 60_000;

/** "2 d 3 h", "1 h 9 m", "5 m". */
export function spanText(ms: number): string {
  const m = Math.max(0, Math.floor(ms / MIN));
  if (m >= 1440) {
    const d = Math.floor(m / 1440);
    const h = Math.floor((m % 1440) / 60);
    return `${d} d${h ? ` ${h} h` : ''}`;
  }
  if (m >= 60) return `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} m` : ''}`;
  return `${m} m`;
}

/** "0:54:12" for the live timer. */
export function hmsText(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/** Hours as the SLA settings show them: "15 m", "4 h", "36 h". */
export function hoursText(hours: number): string {
  const m = Math.round(hours * 60);
  return m >= 60 && m % 60 === 0 ? `${m / 60} h` : m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} m` : `${m} m`;
}

const hm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

/** "Today 12:50", "Tomorrow 09:00", "Yesterday 18:10", "Fri 20 Nov 17:40". */
export function whenText(iso: string | number, now = Date.now(), short = false): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(d) - day(new Date(now))) / 86_400_000);
  if (diff === 0) return short ? hm(d) : `Today ${hm(d)}`;
  if (diff === 1) return `Tomorrow ${hm(d)}`;
  if (diff === -1) return `Yesterday ${hm(d)}`;
  return `${d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} ${hm(d)}`;
}

/* ---------- the SLA state of a ticket ---------- */

export type SlaState = 'ok' | 'warn' | 'hot' | 'breach' | 'paused' | 'done';
export const SLA_HUE: Record<SlaState, string> = { ok: '#1f9d63', warn: '#d9a21a', hot: '#e0611a', breach: '#d33a3a', paused: '#8a93a6', done: '#1f9d63' };

export const isOpenTicket = (t: Pick<Ticket, 'status'>) => !TICKET_DONE.includes(t.status);
const ms = (iso: string | null | undefined) => (iso ? Date.parse(iso) : NaN);

/** Time left to resolve: frozen while paused and once resolved. Negative when over. */
export function leftMs(t: Ticket, now: number): number {
  const end = !isOpenTicket(t) && t.resolvedAt ? ms(t.resolvedAt) : t.pausedAt ? ms(t.pausedAt) : now;
  return ms(t.slaDue) - end;
}

/** The ticket's whole resolve window, less paused time. */
export function windowMs(t: Ticket): number {
  return Math.max(MIN, ms(t.slaDue) - ms(t.createdAt) - (t.pausedMinutes ?? 0) * MIN);
}

export function usedShare(t: Ticket, now: number): number {
  return Math.min(1, Math.max(0, (windowMs(t) - leftMs(t, now)) / windowMs(t)));
}

export function slaState(t: Ticket, now: number, warnPercent = 80): SlaState {
  if (!isOpenTicket(t)) return 'done';
  if (t.pausedAt) return 'paused';
  const left = leftMs(t, now);
  if (!Number.isFinite(left)) return 'ok';
  if (left < 0) return 'breach';
  const used = usedShare(t, now) * 100;
  if (used >= warnPercent || left < 30 * MIN) return 'hot';
  if (used >= warnPercent * 0.6) return 'warn';
  return 'ok';
}

/** Whether a resolved ticket kept its promise. Null while open or when nothing says when it was resolved. */
export function slaMet(t: Ticket): boolean | null {
  if (isOpenTicket(t) || !t.resolvedAt) return null;
  return ms(t.resolvedAt) <= ms(t.slaDue);
}

export function stateHue(t: Ticket, now: number, warnPercent = 80): string {
  const s = slaState(t, now, warnPercent);
  return s === 'done' && slaMet(t) === false ? SLA_HUE.breach : SLA_HUE[s];
}

/** The two lines under a ticket's fuse. */
export function fuseText(t: Ticket, now: number, warnPercent = 80): [string, string] {
  const s = slaState(t, now, warnPercent);
  const left = leftMs(t, now);
  if (s === 'done') {
    const met = slaMet(t);
    if (met === null) return [t.status, ''];
    return met ? [`Met · ${spanText(left)} to spare`, whenText(t.resolvedAt!, now, true)] : [`Missed by ${spanText(-left)}`, whenText(t.resolvedAt!, now, true)];
  }
  if (s === 'paused') return [`Paused · ${spanText(left)} left`, 'waiting on customer'];
  if (s === 'breach') return [`Breached ${spanText(-left)} ago`, `was due ${whenText(t.slaDue, now, true)}`];
  if (left < 86_400_000) return [`${spanText(left)} left`, `due ${whenText(t.slaDue, now, true)}`];
  return [`Due ${whenText(t.slaDue, now)}`, `${spanText(left)} left`];
}

/** First reply still owed: how long until it is due, or how late it is. */
export function firstReplyInfo(t: Ticket, now: number): { late: boolean; ms: number } | null {
  if (t.firstReplyAt || !t.firstReplyDue || !isOpenTicket(t)) return null;
  const left = ms(t.firstReplyDue) - (t.pausedAt ? ms(t.pausedAt) : now);
  return { late: left < 0, ms: Math.abs(left) };
}

/* ---------- queue views ---------- */

export interface ViewContext { now: number; me: string | undefined; warnPercent: number }
export interface TicketView { id: string; label: string; test: (t: Ticket, c: ViewContext) => boolean }

export const TICKET_VIEWS: TicketView[] = [
  { id: 'open', label: 'All open tickets', test: (t) => isOpenTicket(t) },
  { id: 'mine', label: 'My open tickets', test: (t, c) => isOpenTicket(t) && !!c.me && t.ownerId === c.me },
  { id: 'unassigned', label: 'Unassigned', test: (t) => isOpenTicket(t) && !t.ownerId },
  { id: 'breach', label: 'Breached', test: (t, c) => slaState(t, c.now, c.warnPercent) === 'breach' },
  { id: 'hour', label: 'Due within 1 hour', test: (t, c) => ['ok', 'warn', 'hot'].includes(slaState(t, c.now, c.warnPercent)) && leftMs(t, c.now) <= 60 * MIN },
  { id: 'firstreply', label: 'Waiting for a first reply', test: (t) => isOpenTicket(t) && !t.firstReplyAt && !!t.firstReplyDue },
  { id: 'paused', label: 'Waiting on customer', test: (t, c) => slaState(t, c.now, c.warnPercent) === 'paused' },
  { id: 'escalated', label: 'Escalated', test: (t) => isOpenTicket(t) && (t.escalation ?? 0) > 0 },
  { id: 'done', label: 'Resolved and closed', test: (t) => !isOpenTicket(t) },
  { id: 'all', label: 'Every ticket', test: () => true },
];
export const viewById = (id: string) => TICKET_VIEWS.find((v) => v.id === id) ?? TICKET_VIEWS[0];

/** Open tickets first, the one with least time left on top; paused ones after running ones; then the latest resolved. */
export function sortQueue(list: Ticket[], now: number): Ticket[] {
  return [...list].sort((a, b) => {
    const ao = isOpenTicket(a);
    const bo = isOpenTicket(b);
    if (ao !== bo) return ao ? -1 : 1;
    if (!ao) return (ms(b.resolvedAt) || ms(b.createdAt)) - (ms(a.resolvedAt) || ms(a.createdAt));
    const ap = !!a.pausedAt;
    const bp = !!b.pausedAt;
    if (ap !== bp) return ap ? 1 : -1;
    return (leftMs(a, now) || 0) - (leftMs(b, now) || 0);
  });
}

export function matchesSearch(t: Ticket, q: string, extra = ''): boolean {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  return `${ticketRef(t)} ${t.subject} ${t.requester} ${t.category ?? ''} ${t.channel ?? ''} ${extra}`.toLowerCase().includes(s);
}

/** A short reference people can say on the phone: TK- and the last four digits of the id. */
export function ticketRef(t: Pick<Ticket, 'id'>): string {
  const digits = t.id.replace(/\D/g, '');
  return `TK-${(digits.slice(-4) || '0').padStart(4, '0')}`;
}

/** Share of tickets resolved in the last seven days that met their SLA, and the same per day (oldest first). */
export function metThisWeek(tickets: Ticket[], now: number): { share: number | null; days: (number | null)[] } {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const days: (number | null)[] = [];
  let met = 0;
  let total = 0;
  for (let i = 6; i >= 0; i--) {
    const from = start.getTime() - i * 86_400_000;
    const to = from + 86_400_000;
    const done = tickets.filter((t) => t.resolvedAt && ms(t.resolvedAt) >= from && ms(t.resolvedAt) < to && slaMet(t) !== null);
    const ok = done.filter((t) => slaMet(t)).length;
    met += ok;
    total += done.length;
    days.push(done.length ? Math.round((ok / done.length) * 100) : null);
  }
  return { share: total ? Math.round((met / total) * 100) : null, days };
}

/* ---------- form helpers ---------- */

const STOP = new Set(['the', 'and', 'not', 'for', 'after', 'with', 'from', 'our', 'your', 'has', 'was', 'are', 'can', 'any']);

/** Open tickets whose subject shares a word (three letters or more) with what is being typed. */
export function similarTickets(subject: string, tickets: Ticket[], excludeId?: string, limit = 3): Ticket[] {
  const words = subject.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !STOP.has(w));
  if (!words.length) return [];
  return tickets.filter((t) => isOpenTicket(t) && t.id !== excludeId && words.some((w) => t.subject.toLowerCase().includes(w))).slice(0, limit);
}

/** When the first reply and the resolve would be due for a ticket raised at `from` with this priority. */
export function promiseFor(priority: TicketPriority, from: number, configs = slaConfigsNow(), rules = slaRulesNow()) {
  const policy = policyFor(priority, configs);
  return {
    policy,
    firstReplyDue: addSlaMinutes(from, policy.firstReplyMinutes, policy.clock, rules),
    slaDue: addSlaMinutes(from, policy.resolveMinutes, policy.clock, rules),
  };
}

export function fillCanned(text: string, requester: string): string {
  const first = requester.trim().split(/\s+/)[0] || 'there';
  return text.replace(/\{first_name\}/g, first);
}

/** A canned reply's name in the picker: its first words after the greeting. */
export function cannedLabel(text: string): string {
  const body = text.replace(/^hello\s+\{first_name\},?\s*/i, '');
  const words = body.split(/\s+/).slice(0, 7).join(' ');
  return words.length < body.length ? `${words}…` : words;
}

/* ---------- the conversation ---------- */

export interface ThreadItem {
  id: string;
  kind: 'customer' | 'reply' | 'note' | 'system';
  by: string;
  byId: string | null;
  text: string;
  at: string;
}

/** The customer's message (the description) first, then replies, notes and the CRM's own lines in time order. */
export function threadOf(t: Ticket): ThreadItem[] {
  const items: ThreadItem[] = [];
  if (t.description.trim()) items.push({ id: `${t.id}-description`, kind: 'customer', by: t.requester, byId: null, text: t.description, at: t.createdAt });
  const comments = [...t.comments].sort((a: TicketComment, b: TicketComment) => ms(a.createdAt) - ms(b.createdAt));
  for (const c of comments) items.push({ id: c.id, kind: c.kind ?? 'reply', by: c.author, byId: c.authorId ?? null, text: c.text, at: c.createdAt });
  return items;
}

/** Statuses a ticket can move to from where it is. */
export const nextStatuses = (status: TicketStatus) => TICKET_TRANSITIONS[status] ?? [];
