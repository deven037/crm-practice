import { Router } from 'express';
import { z } from 'zod';
import { store } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { CustomFieldModule, Role, SearchHistory, User } from '../types.js';

/**
 * Search 3.0 (module 11). One ranked list over every module a person can open, custom fields included.
 * The quick search (Ctrl K) and the /search page both read it: the quick search groups the first page by type,
 * the page shows it with the type bar, facets and paging.
 */

const MIN_TERM_LENGTH = 2;
export const SEARCH_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 60;
/** Recent searches kept per person. */
export const RECENT_SEARCH_LIMIT = 8;

/** Record types in the order their groups show. */
export const SEARCH_TYPES = ['lead', 'contact', 'account', 'deal', 'ticket', 'quote', 'product', 'campaign', 'meeting', 'task'] as const;
export type SearchType = (typeof SEARCH_TYPES)[number];

/** When names tie, customers and people come first: they are what most searches are for. */
const TYPE_WEIGHT: Partial<Record<SearchType, number>> = { account: 8, contact: 6, lead: 6, deal: 4, ticket: 3 };

// Owner decision (AIO-202, question #112): Viewer has no Email/Phone permission, so those
// values are neither returned nor matched for that role.
const CONTACT_DETAIL_ROLES: Role[] = ['admin', 'rep'];
export const canViewContactDetails = (role: Role) => CONTACT_DETAIL_ROLES.includes(role);

const csv = z
  .string()
  .optional()
  .transform((v) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : []));

const searchQuerySchema = z.object({
  q: z
    .string({ required_error: 'Enter a search term.' })
    .trim()
    .min(MIN_TERM_LENGTH, `Search term must be at least ${MIN_TERM_LENGTH} characters.`)
    .max(200, 'Search term must be 200 characters or fewer.'),
  /** Facet picks from the results page; they narrow the list but not the counts. */
  types: csv,
  owners: csv,
  statuses: csv,
  page: z.coerce.number().int().min(1).max(1000).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(SEARCH_PAGE_SIZE),
});

export interface SearchHit {
  type: SearchType;
  id: string;
  /** A reference people type: TK-0010, Q-2026-0142, a product SKU. Empty when the record has none. */
  ref: string;
  title: string;
  sub: string;
  ownerId: string | null;
  ownerName: string;
  status: string;
  /** Newest date the record changed that the CRM knows about (ISO). */
  at: string;
  amount: number | null;
  /** Where the term was found when it was not the name: "Reference", "Details", "Email", a custom field's label. */
  matchedIn: string;
  matchedValue: string;
  score: number;
  /** Label and value pairs for the preview; email and phone only for roles that may see them. */
  fields: [string, string][];
}

export interface SearchFilters {
  type: string[];
  owner: string[];
  status: string[];
}

export interface SearchResult {
  term: string;
  /** The words left after taking out type:, owner: and status: filters. */
  text: string;
  filters: SearchFilters;
  /** Set when the term is exactly a record's reference: the quick search offers to go straight to it. */
  jump: SearchHit | null;
  /** All matches before the facet picks. */
  total: number;
  counts: Partial<Record<SearchType, number>>;
  owners: { id: string; name: string; count: number }[];
  statuses: { name: string; count: number }[];
  /** Matches after the facet picks, and the page of them asked for. */
  shown: number;
  items: SearchHit[];
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface SearchOptions {
  types?: string[];
  owners?: string[];
  statuses?: string[];
  page?: number;
  pageSize?: number;
}

const FILTER_KEYS = ['type', 'owner', 'status'] as const;
const TOKEN = /(type|owner|status):(?:"([^"]*)"|(\S+))/gi;

/** Splits "kapoor type:ticket owner:me status:"in progress"" into filters and the words to look for. */
export function parseQuery(term: string): { filters: SearchFilters; text: string } {
  const filters: SearchFilters = { type: [], owner: [], status: [] };
  const text = term
    .replace(TOKEN, (_all, key: string, quoted: string | undefined, plain: string | undefined) => {
      const value = (quoted ?? plain ?? '').trim().toLowerCase();
      if (value) filters[key.toLowerCase() as (typeof FILTER_KEYS)[number]].push(value);
      return ' ';
    })
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  return { filters, text };
}

/** ticket-12 → TK-0012. The same rule as the Tickets pages (src/pages/tickets/ticketLogic.ts). */
export function ticketRef(id: string): string {
  const digits = id.replace(/\D/g, '');
  return `TK-${(digits.slice(-4) || '0').padStart(4, '0')}`;
}

const PHONE_TERM = /^[\d\s\-()+.]+$/;
const digitsOf = (value: string) => value.replace(/\D/g, '');
const squash = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
const latest = (...dates: (string | null | undefined)[]) => dates.filter(Boolean).sort().pop() ?? '';

interface Candidate {
  type: SearchType;
  id: string;
  ref: string;
  title: string;
  sub: string;
  ownerId: string | null;
  status: string;
  at: string;
  amount: number | null;
  /** Other searchable values: [label, value]. */
  extra: [string, string][];
  /** Email and phone: matched and shown only with permission. */
  private: [string, string][];
  module?: CustomFieldModule;
  customFields?: Record<string, string | number | boolean | null>;
}

/** A quote's name: its products (the first two and how many more), or the account when it has none yet. */
const quoteTitle = (products: string[], fallback: string) =>
  products.length === 0 ? fallback : products.length <= 2 ? products.join(' and ') : `${products.slice(0, 2).join(', ')} and ${products.length - 2} more`;

function candidates(): Candidate[] {
  const accountName = (id: string | null | undefined) => (id ? store.accounts.get(id)?.name ?? '' : '');
  const contactName = (id: string | null | undefined) => (id ? store.contacts.get(id)?.name ?? '' : '');
  const out: Candidate[] = [];

  for (const l of store.leads.all()) {
    // Converted leads live on as contacts, accounts and deals.
    if (l.status === 'Converted') continue;
    out.push({
      type: 'lead', id: l.id, ref: '', title: l.name, sub: l.company, ownerId: l.ownerId, status: l.status, at: l.createdAt,
      amount: l.value || null, extra: [['Company', l.company], ['Source', l.source]], private: [['Email', l.email], ['Phone', l.phone]],
      module: 'leads', customFields: l.customFields,
    });
  }
  for (const c of store.contacts.all()) {
    const account = accountName(c.accountId);
    out.push({
      type: 'contact', id: c.id, ref: '', title: c.name, sub: [c.title, account].filter(Boolean).join(', '), ownerId: null, status: '',
      at: latest(c.createdAt, ...c.notes.map((n) => n.createdAt)), amount: null,
      extra: [['Account', account], ['Title', c.title], ['Tags', c.tags.join(', ')]], private: [['Email', c.email], ['Phone', c.phone]],
      module: 'contacts', customFields: c.customFields,
    });
  }
  for (const a of store.accounts.all()) {
    out.push({
      type: 'account', id: a.id, ref: '', title: a.name, sub: a.industry, ownerId: a.ownerId, status: '', at: a.createdAt,
      amount: a.revenue || null, extra: [['Industry', a.industry], ['Website', a.website]], private: [['Phone', a.phone]],
      module: 'accounts', customFields: a.customFields,
    });
  }
  for (const d of store.deals.all()) {
    const account = accountName(d.accountId);
    out.push({
      type: 'deal', id: d.id, ref: '', title: d.name, sub: account, ownerId: d.ownerId, status: d.stage,
      at: latest(d.createdAt, ...(d.stageHistory ?? []).map((e) => e.at)), amount: d.amount,
      extra: [['Account', account], ['Next step', d.nextStep ?? ''], ['Lost reason', d.lostReason ?? '']], private: [],
      module: 'deals', customFields: d.customFields,
    });
  }
  for (const t of store.tickets.all()) {
    const who = t.requester || contactName(t.contactId);
    out.push({
      type: 'ticket', id: t.id, ref: ticketRef(t.id), title: t.subject, sub: [who, `Priority ${t.priority}`].filter(Boolean).join(' · '),
      ownerId: t.ownerId ?? null, status: t.status, at: latest(t.createdAt, ...t.comments.map((c) => c.createdAt)), amount: null,
      extra: [['Requester', who], ['Account', accountName(t.accountId)], ['Category', t.category ?? ''], ['Description', t.description]],
      private: [], module: 'tickets', customFields: t.customFields,
    });
  }
  for (const q of store.quotes.all()) {
    const account = accountName(q.accountId);
    const value = q.lineItems.reduce((sum, l) => sum + l.quantity * l.unitPrice * (1 - l.discountPct / 100), 0);
    out.push({
      type: 'quote', id: q.id, ref: q.quoteNumber, title: quoteTitle(q.lineItems.map((l) => l.productName), account || q.quoteNumber),
      sub: account, ownerId: q.ownerId ?? null, status: q.status, at: latest(q.createdAt, q.sentAt, q.decidedAt), amount: Math.round(value),
      extra: [['Account', account], ['Products', q.lineItems.map((l) => l.productName).join(', ')]], private: [],
      module: 'quotes', customFields: q.customFields,
    });
  }
  for (const p of store.products.all()) {
    out.push({
      type: 'product', id: p.id, ref: p.sku, title: p.name, sub: [p.category, p.unit && p.unit !== 'One-time' ? p.unit : ''].filter(Boolean).join(' · '),
      ownerId: null, status: p.active ? 'On sale' : 'Not on sale', at: latest(p.createdAt, ...(p.priceHistory ?? []).map((h) => h.at)), amount: p.price,
      extra: [['Family', p.category], ['Description', p.description]], private: [], module: 'products', customFields: p.customFields,
    });
  }
  for (const c of store.campaigns.all()) {
    out.push({
      type: 'campaign', id: c.id, ref: '', title: c.name, sub: c.channel, ownerId: c.ownerId ?? null, status: c.status,
      at: latest(c.createdAt, ...(c.history ?? []).map((h) => h.at)), amount: c.budget,
      extra: [['Channel', c.channel], ['Audience', c.audience ?? '']], private: [], module: 'campaigns', customFields: c.customFields,
    });
  }
  const now = new Date().toISOString();
  for (const m of store.meetings.all()) {
    out.push({
      type: 'meeting', id: m.id, ref: '', title: m.title, sub: [m.type, m.location].filter(Boolean).join(' · '), ownerId: m.ownerId,
      status: m.start < now ? 'Held' : 'Planned', at: m.start, amount: null,
      extra: [['Location', m.location], ['With', m.contactIds.map(contactName).filter(Boolean).join(', ')], ['Notes', m.notes]], private: [],
    });
  }
  for (const t of store.tasks.all()) {
    out.push({
      type: 'task', id: t.id, ref: '', title: t.title, sub: `Due ${t.dueDate.slice(0, 10)} · ${t.priority}`, ownerId: t.ownerId ?? null,
      status: t.completed ? 'Done' : 'Open', at: t.dueDate, amount: null, extra: [['Priority', t.priority]], private: [],
    });
  }
  return out;
}

/** Custom field values a record has, by the field's label. Only kinds people type in are searched. */
function customValues(c: Candidate): [string, string][] {
  if (!c.module || !c.customFields) return [];
  const defs = store.customFieldDefs.all().filter((d) => d.module === c.module && ['text', 'number', 'dropdown'].includes(d.type));
  return defs
    .map((d) => [d.label, c.customFields?.[d.key]] as const)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([label, v]) => [label, String(v)]);
}

const typeMatches = (type: SearchType, wanted: string[]) =>
  wanted.length === 0 ||
  wanted.some((w) => {
    const word = w.replace(/s$/, '');
    return type.startsWith(word) || (word === 'tk' && type === 'ticket') || (word === 'opportunit' && type === 'deal');
  });

/** Runs a search for one person. Pure apart from reading the current bank's store, so tests call it directly. */
export function runSearch(term: string, user: Pick<User, 'id' | 'role'>, options: SearchOptions = {}): SearchResult {
  const { filters, text } = parseQuery(term);
  const showPrivate = canViewContactDetails(user.role);
  const users = new Map(store.users.all().map((u) => [u.id, u.name]));
  const words = text.split(' ').filter(Boolean);
  const phoneDigits = PHONE_TERM.test(text) ? digitsOf(text) : '';
  const nowMs = Date.now();

  /** Every word in the value, as typed or with spaces and punctuation ignored (27AAKPK 4471M). */
  const has = (value: string) => {
    if (!value) return false;
    const lower = value.toLowerCase();
    const flat = squash(value);
    return words.every((w) => lower.includes(w) || (squash(w).length > 0 && flat.includes(squash(w))));
  };
  /** A label and its value together: "PAN AAKPK" finds AAKPK4471M in the PAN number field. */
  const hasLabelled = (label: string, value: string) => {
    if (!value) return false;
    const both = `${label} ${value}`;
    return has(both) && words.some((w) => value.toLowerCase().includes(w) || squash(value).includes(squash(w)));
  };

  const ownerWanted = filters.owner.map((o) => (o === 'me' ? '\u0000me' : o));
  const ownerMatches = (ownerId: string | null) =>
    ownerWanted.length === 0 ||
    ownerWanted.some((o) => (o === '\u0000me' ? ownerId === user.id : (users.get(ownerId ?? '') ?? '').toLowerCase().includes(o)));

  const all: SearchHit[] = [];
  for (const c of candidates()) {
    if (!typeMatches(c.type, filters.type)) continue;
    if (!ownerMatches(c.ownerId)) continue;
    if (filters.status.length && !filters.status.some((s) => c.status.toLowerCase().includes(s))) continue;

    let score = 0;
    let matchedIn = '';
    let matchedValue = '';
    const fields: [string, string][] = [...c.extra, ...customValues(c), ...(showPrivate ? c.private : [])];
    if (words.length) {
      if (c.ref && c.ref.toLowerCase() === text) {
        score = 100; matchedIn = 'Reference'; matchedValue = c.ref;
      } else if (has(c.title)) {
        score = c.title.toLowerCase().startsWith(words[0]) ? 60 : 50; matchedIn = 'Name';
      } else if (c.ref && has(c.ref)) {
        score = 45; matchedIn = 'Reference'; matchedValue = c.ref;
      } else if (has(c.sub)) {
        score = 30; matchedIn = 'Details'; matchedValue = c.sub;
      } else {
        const phoneHit = phoneDigits.length >= MIN_TERM_LENGTH && showPrivate
          ? c.private.find(([label, v]) => label === 'Phone' && digitsOf(v).includes(phoneDigits))
          : undefined;
        const hit = phoneHit ?? fields.find(([label, v]) => has(v) || hasLabelled(label, v));
        if (hit) { score = 25; matchedIn = hit[0]; matchedValue = hit[1]; }
      }
      if (!score) continue;
    } else if (!filters.type.length && !filters.owner.length && !filters.status.length) {
      continue;
    }
    const days = c.at ? Math.max(0, Math.floor((nowMs - Date.parse(c.at)) / 86_400_000)) : 99;
    score += Math.max(0, 6 - days) + (c.ownerId && c.ownerId === user.id ? 3 : 0) + (TYPE_WEIGHT[c.type] ?? 0);
    all.push({
      type: c.type, id: c.id, ref: c.ref, title: c.title, sub: c.sub, ownerId: c.ownerId, ownerName: users.get(c.ownerId ?? '') ?? '',
      status: c.status, at: c.at, amount: c.amount, matchedIn, matchedValue, score,
      fields: fields.filter(([, v]) => v),
    });
  }
  all.sort((a, b) => b.score - a.score || b.at.localeCompare(a.at) || a.title.localeCompare(b.title));

  const counts: Partial<Record<SearchType, number>> = {};
  const owners = new Map<string, { id: string; name: string; count: number }>();
  const statuses = new Map<string, number>();
  for (const h of all) {
    counts[h.type] = (counts[h.type] ?? 0) + 1;
    if (h.ownerId) {
      const o = owners.get(h.ownerId) ?? { id: h.ownerId, name: h.ownerName || 'Someone who left', count: 0 };
      o.count++;
      owners.set(h.ownerId, o);
    }
    if (h.status) statuses.set(h.status, (statuses.get(h.status) ?? 0) + 1);
  }

  const pickTypes = options.types ?? [];
  const pickOwners = options.owners ?? [];
  const pickStatuses = options.statuses ?? [];
  const shownHits = all.filter(
    (h) =>
      (!pickTypes.length || pickTypes.includes(h.type)) &&
      (!pickOwners.length || pickOwners.includes(h.ownerId ?? '')) &&
      (!pickStatuses.length || pickStatuses.includes(h.status))
  );
  const pageSize = options.pageSize ?? SEARCH_PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(shownHits.length / pageSize));
  const page = Math.min(options.page ?? 1, totalPages);

  return {
    term,
    text,
    filters,
    jump: all.find((h) => h.score >= 100 && h.matchedIn === 'Reference') ?? null,
    total: all.length,
    counts,
    owners: [...owners.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    statuses: [...statuses.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    shown: shownHits.length,
    items: shownHits.slice((page - 1) * pageSize, page * pageSize),
    page,
    pageSize,
    totalPages,
  };
}

const historyId = (userId: string) => `user-${userId}`;

export function recentSearches(userId: string): string[] {
  return store.searchHistory.get(historyId(userId))?.terms ?? [];
}

/** Adds a term to the front of the person's recent searches; the same term typed again moves up instead of repeating. */
export function rememberSearch(userId: string, term: string): string[] {
  const clean = term.trim().replace(/\s+/g, ' ');
  const terms = [clean, ...recentSearches(userId).filter((t) => t.toLowerCase() !== clean.toLowerCase())].slice(0, RECENT_SEARCH_LIMIT);
  const row: SearchHistory = { id: historyId(userId), userId, terms, updatedAt: new Date().toISOString() };
  if (store.searchHistory.get(row.id)) store.searchHistory.replace(row.id, row);
  else store.searchHistory.create(row);
  return terms;
}

const recentBody = z.object({ term: z.string().trim().min(MIN_TERM_LENGTH).max(200) });

export const searchRouter = Router();

// GET /api/search?q=&types=&owners=&statuses=&page=&pageSize= — ranked matches with counts by type, owner and status.
searchRouter.get('/', requireAuth, (req, res) => {
  const { q, ...options } = searchQuerySchema.parse(req.query);
  res.json(runSearch(q, req.user!, options));
});

// GET /api/search/recent — the signed-in person's recent searches, newest first.
searchRouter.get('/recent', requireAuth, (req, res) => {
  res.json({ terms: recentSearches(req.user!.id) });
});

// POST /api/search/recent — remember a search the person acted on (opened a result or the results page).
searchRouter.post('/recent', requireAuth, validateBody(recentBody), (req, res) => {
  res.json({ terms: rememberSearch(req.user!.id, (req.body as { term: string }).term) });
});

// DELETE /api/search/recent — forget them all.
searchRouter.delete('/recent', requireAuth, (req, res) => {
  store.searchHistory.remove(historyId(req.user!.id));
  res.status(204).end();
});
