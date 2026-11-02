import { Router } from 'express';
import { z } from 'zod';
import { store } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { Role } from '../types.js';

const MIN_TERM_LENGTH = 2;
const DEFAULT_LIMIT = 3;
const MAX_LIMIT = 10;

const searchQuerySchema = z.object({
  q: z
    .string({ required_error: 'Enter a search term.' })
    .trim()
    .min(MIN_TERM_LENGTH, `Search term must be at least ${MIN_TERM_LENGTH} characters.`)
    .max(100, 'Search term must be 100 characters or fewer.'),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
});

// Owner decision (AIO-202, question #112): Viewer has no Email/Phone permission, so those
// values are neither returned nor matched for that role.
const CONTACT_DETAIL_ROLES: Role[] = ['admin', 'rep'];
export const canViewContactDetails = (role: Role) => CONTACT_DETAIL_ROLES.includes(role);

export interface SearchHit {
  id: string;
  name: string;
  subtitle: string;
  email?: string;
  phone?: string;
}

export interface SearchGroup {
  items: SearchHit[];
  total: number;
}

export interface SearchResponse {
  term: string;
  leads: SearchGroup;
  contacts: SearchGroup;
  accounts: SearchGroup;
  deals: SearchGroup;
}

const PHONE_TERM = /^[\d\s\-()+.]+$/;
const digitsOf = (value: string) => value.replace(/\D/g, '');

function group<T>(rows: T[], limit: number, toHit: (row: T) => SearchHit): SearchGroup {
  return { items: rows.slice(0, limit).map(toHit), total: rows.length };
}

export function runSearch(term: string, limit: number, showContactDetails: boolean): SearchResponse {
  const text = term.toLowerCase();
  const phoneDigits = PHONE_TERM.test(term) ? digitsOf(term) : '';
  const hasText = (value: string | null | undefined) => (value ?? '').toLowerCase().includes(text);
  const hasPhone = (value: string) =>
    showContactDetails && phoneDigits.length >= MIN_TERM_LENGTH && digitsOf(value).includes(phoneDigits);
  const hasEmail = (value: string) => showContactDetails && hasText(value);
  const contactDetails = (email: string, phone: string) => (showContactDetails ? { email, phone } : {});

  const leads = store.leads
    .all()
    .filter((l) => l.status !== 'Converted')
    .filter((l) => hasText(l.name) || hasText(l.company) || hasEmail(l.email) || hasPhone(l.phone));

  const accountName = (id: string | null) => (id ? store.accounts.get(id)?.name ?? '' : '');
  const contacts = store.contacts
    .all()
    .filter((c) => hasText(c.name) || hasText(accountName(c.accountId)) || hasEmail(c.email) || hasPhone(c.phone));

  const accounts = store.accounts.all().filter((a) => hasText(a.name) || hasPhone(a.phone));

  const deals = store.deals.all().filter((d) => hasText(d.name));

  return {
    term,
    leads: group(leads, limit, (l) => ({ id: l.id, name: l.name, subtitle: l.company, ...contactDetails(l.email, l.phone) })),
    contacts: group(contacts, limit, (c) => ({
      id: c.id,
      name: c.name,
      subtitle: accountName(c.accountId),
      ...contactDetails(c.email, c.phone),
    })),
    accounts: group(accounts, limit, (a) => ({ id: a.id, name: a.name, subtitle: a.industry, ...(showContactDetails ? { phone: a.phone } : {}) })),
    deals: group(deals, limit, (d) => ({ id: d.id, name: d.name, subtitle: d.stage })),
  };
}

export const searchRouter = Router();

searchRouter.get('/', requireAuth, (req, res) => {
  const { q, limit } = searchQuerySchema.parse(req.query);
  res.json(runSearch(q, limit, canViewContactDetails(req.user!.role)));
});
