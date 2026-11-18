import { Quote, QuoteSettings, QuoteStatus, QUOTE_REJECT_REASONS, User } from '../../types';
import { bankProfileSync, getAllSync } from '../../data/store';
import { getStatusOptions } from '../../utils/rules';
import { needsApproval, quoteSums, settingsOf } from './quoteMath';

export const quoteSettingsNow = (): QuoteSettings => settingsOf(getAllSync<QuoteSettings>('quoteSettings'));
export const rejectReasons = (): string[] => getStatusOptions('quotes', 'rejectReason', QUOTE_REJECT_REASONS);

export const STATUS_HUE: Record<QuoteStatus, string> = { Draft: '#8a93a6', Sent: '#2f6fe0', Accepted: '#1f9d63', Rejected: '#d33a3a', Expired: '#c98a12' };
export const quoteHue = (s: string) => STATUS_HUE[s as QuoteStatus] ?? '#8a93a6';
export const DECIDED: QuoteStatus[] = ['Accepted', 'Rejected', 'Expired'];
export const isDecided = (q: Pick<Quote, 'status'>) => DECIDED.includes(q.status);
export const canWriteQuotes = (role: string | undefined) => role === 'admin' || role === 'rep';

/** Who may approve: the bank's named approver, or any admin (always, and when nobody is named). */
export function mayApprove(user: Pick<User, 'id' | 'role'> | null | undefined, settings: QuoteSettings): boolean {
  if (!user) return false;
  return user.role === 'admin' || (!!settings.approverId && user.id === settings.approverId);
}

export const firstYearOf = (q: Pick<Quote, 'lineItems'>, settings = quoteSettingsNow()) => quoteSums(q.lineItems, settings.taxPercent).firstYear;
export const waitingApproval = (q: Quote, limit = quoteSettingsNow().discountLimit) => q.status === 'Draft' && needsApproval(q, limit) && q.approval !== 'approved';

// ---- money in the bank's currency ----
let fmtKey = '';
let fmtFull: Intl.NumberFormat | null = null;
let fmtShort: Intl.NumberFormat | null = null;
function formatters() {
  const bank = bankProfileSync();
  const key = `${bank?.locale ?? ''}|${bank?.currency ?? ''}`;
  if (key !== fmtKey || !fmtFull || !fmtShort) {
    fmtKey = key;
    const make = (compact: boolean) => {
      try {
        return new Intl.NumberFormat(bank?.locale || 'en-IN', { style: 'currency', currency: bank?.currency || 'INR', maximumFractionDigits: compact ? 1 : 0, ...(compact ? { notation: 'compact' as const } : {}) });
      } catch {
        // A wrong locale or currency in the bank's settings must not break the page.
        return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: compact ? 1 : 0, ...(compact ? { notation: 'compact' as const } : {}) });
      }
    };
    fmtFull = make(false);
    fmtShort = make(true);
  }
  return { full: fmtFull, short: fmtShort };
}
export const money = (n: number) => formatters().full.format(Math.round(n || 0));
/** Compact from 10,000 up (₹2.4L, $310K); smaller sums in full. */
export const moneyShort = (n: number) => (Math.abs(n || 0) < 10_000 ? money(n) : formatters().short.format(n));

// ---- dates ----
const DAY = 86_400_000;
const startOfDay = (ms: number) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };
/** Whole calendar days from today to the date (negative when past). */
export const daysUntil = (iso: string, now = Date.now()) => Math.round((startOfDay(Date.parse(iso)) - startOfDay(now)) / DAY);
export const dayText = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
export function shortDay(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return '—';
  const d = daysUntil(iso, now);
  if (d === 0) return 'Today';
  if (d === -1) return 'Yesterday';
  if (d === 1) return 'Tomorrow';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}
export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export interface Validity {
  /** 'left': sent and still valid; 'lapsed': sent and past its date with no answer. */
  kind: 'draft' | 'left' | 'lapsed' | 'decided';
  days: number;
  /** Share of the validity period still left (0 to 1), for the ring. */
  share: number;
  tone: '' | 'soon' | 'late';
}

export function validityOf(q: Quote, now = Date.now()): Validity {
  const days = daysUntil(q.validUntil, now);
  if (isDecided(q)) return { kind: 'decided', days, share: 0, tone: '' };
  if (q.status === 'Draft') return { kind: 'draft', days, share: 1, tone: '' };
  if (days < 0) return { kind: 'lapsed', days, share: 0, tone: 'late' };
  const start = Date.parse(q.sentAt ?? q.createdAt);
  const total = Math.max(1, (Date.parse(q.validUntil) - start) / DAY);
  return { kind: 'left', days, share: Math.max(0.04, Math.min(1, days / total)), tone: days <= 2 ? 'late' : days <= 7 ? 'soon' : '' };
}

export const expiringSoon = (q: Quote, now = Date.now()) => q.status === 'Sent' && daysUntil(q.validUntil, now) <= 7;

/** The desk's filters: a status, waiting for approval, or expiring within 7 days. */
export type QuoteFilter = 'all' | 'approval' | 'soon' | QuoteStatus;
export function filterTest(f: QuoteFilter, now = Date.now(), limit = quoteSettingsNow().discountLimit): (q: Quote) => boolean {
  if (f === 'all') return () => true;
  if (f === 'approval') return (q) => waitingApproval(q, limit);
  if (f === 'soon') return (q) => expiringSoon(q, now);
  return (q) => q.status === f;
}
export const FILTER_TITLE: Record<string, string> = { approval: 'Needs approval', soon: 'Expiring within 7 days' };

export function matchesQuote(q: Quote, query: string, accountName: string, dealName: string): boolean {
  const s = query.trim().toLowerCase();
  return !s || `${q.quoteNumber} ${accountName} ${dealName}`.toLowerCase().includes(s);
}

/** Drafts newest first; sent ones by the least time left; decided ones newest answer first. */
export function quoteGroups(quotes: Quote[]): { id: 'draft' | 'sent' | 'decided'; title: string; sub: string; list: Quote[] }[] {
  const time = (iso: string | null | undefined) => (iso ? Date.parse(iso) : 0);
  return [
    { id: 'draft' as const, title: 'Needs you', sub: 'Drafts to finish, approve or send', list: quotes.filter((q) => q.status === 'Draft').sort((a, b) => time(b.createdAt) - time(a.createdAt)) },
    { id: 'sent' as const, title: 'With the customer', sub: 'Sent, waiting for an answer', list: quotes.filter((q) => q.status === 'Sent').sort((a, b) => time(a.validUntil) - time(b.validUntil)) },
    { id: 'decided' as const, title: 'Decided', sub: 'Accepted, rejected or expired', list: quotes.filter(isDecided).sort((a, b) => time(b.decidedAt ?? b.createdAt) - time(a.decidedAt ?? a.createdAt)) },
  ].filter((g) => g.list.length > 0);
}

/** Value per status for the fan chart, in workflow order. */
export function statusTotals(quotes: Quote[], settings = quoteSettingsNow()) {
  return (['Draft', 'Sent', 'Accepted', 'Rejected', 'Expired'] as QuoteStatus[]).map((s) => {
    const list = quotes.filter((q) => q.status === s);
    return { status: s, count: list.length, value: list.reduce((t, q) => t + firstYearOf(q, settings), 0) };
  });
}

/** The next number in the bank's series, for the live preview of a new quote (the server keeps its own). */
export function previewNumber(quotes: Quote[], year = new Date().getFullYear()): string {
  const prefix = `Q-${year}-`;
  const nums = quotes.map((q) => (q.quoteNumber.startsWith(prefix) ? Number(q.quoteNumber.slice(prefix.length)) : NaN)).filter((n) => Number.isFinite(n) && n < 100_000); // older numbers were six-digit time stamps, not a series
  return `${prefix}${String((nums.length ? Math.max(...nums) : 0) + 1).padStart(4, '0')}`;
}
