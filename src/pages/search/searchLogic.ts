import {
  Building2, CalendarDays, CheckSquare, FileText, Megaphone, Package, Phone, Plus, Target, Ticket, TrendingUp, User, type LucideIcon,
} from 'lucide-react';
import { apiFetch } from '../../data/apiFetch';
import type { Role } from '../../types';

/** Search 3.0 (module 11): what GET /api/search returns. Mirrors server/src/routes/search.ts. */
export const SEARCH_TYPES = ['lead', 'contact', 'account', 'deal', 'ticket', 'quote', 'product', 'campaign', 'meeting', 'task'] as const;
export type SearchType = (typeof SEARCH_TYPES)[number];

export interface SearchHit {
  type: SearchType;
  id: string;
  ref: string;
  title: string;
  sub: string;
  ownerId: string | null;
  ownerName: string;
  status: string;
  at: string;
  amount: number | null;
  matchedIn: string;
  matchedValue: string;
  score: number;
  fields: [string, string][];
}

export interface SearchResult {
  term: string;
  text: string;
  filters: { type: string[]; owner: string[]; status: string[] };
  jump: SearchHit | null;
  total: number;
  counts: Partial<Record<SearchType, number>>;
  owners: { id: string; name: string; count: number }[];
  statuses: { name: string; count: number }[];
  shown: number;
  items: SearchHit[];
  page: number;
  pageSize: number;
  totalPages: number;
}

export const SEARCH_MIN_CHARS = 2;

/** Each type's names, colour and icon; colours follow the modules' own pages. `key` is the old grouped search's name, kept for test ids. */
export const TYPE_META: Record<SearchType, { label: string; one: string; key: string; hue: string; icon: LucideIcon }> = {
  lead: { label: 'Leads', one: 'Lead', key: 'leads', hue: '#2f6fe0', icon: Target },
  contact: { label: 'Contacts', one: 'Contact', key: 'contacts', hue: '#0f97a8', icon: User },
  account: { label: 'Accounts', one: 'Account', key: 'accounts', hue: '#6d4fd6', icon: Building2 },
  deal: { label: 'Deals', one: 'Deal', key: 'deals', hue: '#1f9d63', icon: TrendingUp },
  ticket: { label: 'Tickets', one: 'Ticket', key: 'tickets', hue: '#d33a3a', icon: Ticket },
  quote: { label: 'Quotes', one: 'Quote', key: 'quotes', hue: '#7a4fd6', icon: FileText },
  product: { label: 'Products', one: 'Product', key: 'products', hue: '#b8860b', icon: Package },
  campaign: { label: 'Campaigns', one: 'Campaign', key: 'campaigns', hue: '#d9467a', icon: Megaphone },
  meeting: { label: 'Meetings', one: 'Meeting', key: 'meetings', hue: '#0e7c8a', icon: CalendarDays },
  task: { label: 'Tasks', one: 'Task', key: 'tasks', hue: '#c98a12', icon: CheckSquare },
};

export const isSearchType = (value: string): value is SearchType => (SEARCH_TYPES as readonly string[]).includes(value);

/** Where a result opens. Meetings and tasks have no page of their own: people who may edit get the form, viewers the list. */
export function hitPath(hit: Pick<SearchHit, 'type' | 'id'>, role: Role | undefined): string {
  const canEdit = role === 'admin' || role === 'rep';
  if (hit.type === 'meeting') return canEdit ? `/calendar/${hit.id}/edit` : '/calendar';
  if (hit.type === 'task') return canEdit ? `/tasks/${hit.id}/edit` : '/tasks';
  return `/${TYPE_META[hit.type].key}/${hit.id}`;
}

export interface HitAction {
  label: string;
  to: string;
}

const LINKED: Partial<Record<SearchType, string>> = { lead: 'leads', contact: 'contacts', account: 'accounts', deal: 'deals' };
const EDITABLE: SearchType[] = ['account', 'deal', 'ticket', 'quote', 'product', 'campaign'];

/** The extra buttons a result offers besides Open. Viewers only open. */
export function hitActions(hit: Pick<SearchHit, 'type' | 'id'>, role: Role | undefined): HitAction[] {
  if (role !== 'admin' && role !== 'rep') return [];
  const out: HitAction[] = [];
  const linked = LINKED[hit.type];
  if (linked) out.push({ label: 'Log activity', to: `/activity/new?record=${linked}:${encodeURIComponent(hit.id)}` });
  if (hit.type === 'account') out.push({ label: 'New deal', to: `/deals/new?account=${encodeURIComponent(hit.id)}` });
  if (hit.type === 'contact') out.push({ label: 'New ticket', to: `/tickets/new?contact=${encodeURIComponent(hit.id)}` });
  if (hit.type === 'deal') out.push({ label: 'New quote', to: `/quotes/new?deal=${encodeURIComponent(hit.id)}` });
  if (hit.type === 'product') out.push({ label: 'Add to a quote', to: `/quotes/new?product=${encodeURIComponent(hit.id)}` });
  if (EDITABLE.includes(hit.type)) out.push({ label: 'Edit', to: `/${TYPE_META[hit.type].key}/${hit.id}/edit` });
  return out.slice(0, 2);
}

/** What a "> " search lists: things to do, each opening its page ready to fill in. */
export interface QuickAction {
  id: string;
  label: string;
  where: string;
  to: string;
  icon: LucideIcon;
  /** Only people who may create records see it. */
  create: boolean;
}

export const QUICK_ACTIONS: QuickAction[] = [
  { id: 'new-lead', label: 'New lead', where: 'Leads', to: '/leads/new', icon: Plus, create: true },
  { id: 'new-contact', label: 'New contact', where: 'Contacts', to: '/contacts/new', icon: Plus, create: true },
  { id: 'new-account', label: 'New account', where: 'Accounts', to: '/accounts/new', icon: Plus, create: true },
  { id: 'new-deal', label: 'New deal', where: 'Deals', to: '/deals/new', icon: Plus, create: true },
  { id: 'new-ticket', label: 'New ticket', where: 'Tickets', to: '/tickets/new', icon: Plus, create: true },
  { id: 'new-quote', label: 'New quote', where: 'Quotes', to: '/quotes/new', icon: Plus, create: true },
  { id: 'log-call', label: 'Log a call', where: 'Activity', to: '/activity/new', icon: Phone, create: true },
  { id: 'book-meeting', label: 'Book a meeting', where: 'Calendar', to: '/calendar/new', icon: CalendarDays, create: true },
  { id: 'new-task', label: 'New task', where: 'Tasks', to: '/tasks/new', icon: CheckSquare, create: true },
  { id: 'my-tasks', label: 'Open my tasks', where: 'Tasks', to: '/tasks', icon: CheckSquare, create: false },
];

export function matchActions(query: string, role: Role | undefined): QuickAction[] {
  const canCreate = role === 'admin' || role === 'rep';
  const q = query.replace(/^>/, '').trim().toLowerCase();
  return QUICK_ACTIONS.filter((a) => (canCreate || !a.create) && (!q || a.label.toLowerCase().includes(q) || a.where.toLowerCase().includes(q)));
}

export const isActionQuery = (query: string) => query.trimStart().startsWith('>');

/** Splits text into plain and matched parts for <mark>: every word of the search of two letters or more. */
export function highlightParts(text: string, words: string): { text: string; hit: boolean }[] {
  const list = words.toLowerCase().split(/\s+/).filter((w) => w.length > 1).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (!text || list.length === 0) return [{ text, hit: false }];
  const split = new RegExp(`(${list.join('|')})`, 'i');
  const whole = new RegExp(`^(?:${list.join('|')})$`, 'i');
  return text.split(split).filter((part) => part !== '').map((part) => ({ text: part, hit: whole.test(part) }));
}

/** Today, Yesterday, 3 days ago, 12 Nov; and in the future: Tomorrow, In 4 days, 2 Dec. */
export function agoText(iso: string, now = Date.now()): string {
  if (!iso) return '';
  const start = (ms: number) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };
  const days = Math.round((start(now) - start(Date.parse(iso))) / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days === -1) return 'Tomorrow';
  if (days > 1 && days < 7) return `${days} days ago`;
  if (days < -1 && days > -7) return `In ${-days} days`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/** The line under a result's name: where the term was found, when it was not the name. */
export const matchLine = (hit: Pick<SearchHit, 'matchedIn' | 'matchedValue'>) =>
  hit.matchedIn && hit.matchedIn !== 'Name' && hit.matchedIn !== 'Details' && hit.matchedValue ?{ label: hit.matchedIn, value: hit.matchedValue } : null;

/** Groups hits by type in the fixed type order, keeping each group's order. */
export function groupHits(hits: SearchHit[]): { type: SearchType; hits: SearchHit[] }[] {
  return SEARCH_TYPES.map((type) => ({ type, hits: hits.filter((h) => h.type === type) })).filter((g) => g.hits.length > 0);
}

/** The text of a query with its type:, owner: and status: tokens taken out, and the tokens themselves. */
export function splitTokens(query: string): { tokens: string[]; plain: string } {
  const tokens: string[] = [];
  const plain = query
    .replace(/(type|owner|status):(?:"[^"]*"|\S+)/gi, (token) => { tokens.push(token); return ' '; })
    .replace(/\s+/g, ' ')
    .trim();
  return { tokens, plain };
}

export interface SearchParams {
  q: string;
  types?: string[];
  owners?: string[];
  statuses?: string[];
  page?: number;
  pageSize?: number;
}

export function searchUrl({ q, types = [], owners = [], statuses = [], page = 1, pageSize }: SearchParams): string {
  const p = new URLSearchParams({ q });
  if (types.length) p.set('types', types.join(','));
  if (owners.length) p.set('owners', owners.join(','));
  if (statuses.length) p.set('statuses', statuses.join(','));
  if (page > 1) p.set('page', String(page));
  if (pageSize) p.set('pageSize', String(pageSize));
  return `/search?${p.toString()}`;
}

export const fetchSearch = (params: SearchParams) => apiFetch<SearchResult>(searchUrl(params));
export const fetchRecentSearches = () => apiFetch<{ terms: string[] }>('/search/recent').then((r) => r.terms);
export const rememberSearch = (term: string) =>
  apiFetch<{ terms: string[] }>('/search/recent', { method: 'POST', body: JSON.stringify({ term: term.trim() }) }).then((r) => r.terms).catch(() => null);
export const forgetSearches = () => apiFetch<void>('/search/recent', { method: 'DELETE' });

/** The /search page link for a query, with the type picked when it came from a group's "See all". */
export function resultsPagePath(q: string, type?: SearchType): string {
  const p = new URLSearchParams({ q: q.trim() });
  if (type) p.set('types', type);
  return `/search?${p.toString()}`;
}
