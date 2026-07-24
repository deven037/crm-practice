import { buildSeedData } from './seed.js';
import {
  Account,
  Activity,
  AppNotification,
  AuditEntry,
  Campaign,
  Contact,
  CustomFieldDef,
  Deal,
  LayoutDef,
  Lead,
  Product,
  Quote,
  TaskItem,
  Ticket,
  User,
} from './types.js';

export interface ListQuery {
  page?: string | number;
  pageSize?: string | number;
  sort?: string;
  q?: string;
  [filterKey: string]: unknown;
}

export interface ListResult<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

const RESERVED_QUERY_KEYS = new Set(['page', 'pageSize', 'sort', 'q']);

export class Collection<T extends { id: string }> {
  private items: T[] = [];

  constructor(
    private name: string,
    private searchableFields: (keyof T)[] = []
  ) {}

  seed(items: T[]) {
    this.items = items;
  }

  all(): T[] {
    return this.items;
  }

  list(query: ListQuery = {}): ListResult<T> {
    let rows = [...this.items];

    // Free-text search across the collection's searchable fields.
    if (query.q) {
      const q = String(query.q).trim().toLowerCase();
      if (q) {
        rows = rows.filter((item) =>
          this.searchableFields.some((field) => String((item as any)[field] ?? '').toLowerCase().includes(q))
        );
      }
    }

    // Any other query-string key that matches a real field on this collection acts
    // as an exact-match filter (e.g. ?status=New&ownerId=user-2).
    for (const [key, value] of Object.entries(query)) {
      if (RESERVED_QUERY_KEYS.has(key) || value === undefined || value === '') continue;
      if (rows.length > 0 && !(key in (rows[0] as object))) continue;
      rows = rows.filter((item) => String((item as any)[key]) === String(value));
    }

    if (query.sort) {
      const desc = query.sort.startsWith('-');
      const field = desc ? query.sort.slice(1) : query.sort;
      rows.sort((a, b) => {
        const av = (a as any)[field];
        const bv = (b as any)[field];
        if (av === bv) return 0;
        const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv));
        return desc ? -cmp : cmp;
      });
    }

    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 25));
    const total = rows.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const data = rows.slice((page - 1) * pageSize, page * pageSize);

    return { data, page, pageSize, total, totalPages };
  }

  get(id: string): T | undefined {
    return this.items.find((i) => i.id === id);
  }

  create(item: T): T {
    this.items.unshift(item);
    return item;
  }

  update(id: string, patch: Partial<T>): T | undefined {
    const idx = this.items.findIndex((i) => i.id === id);
    if (idx < 0) return undefined;
    this.items[idx] = { ...this.items[idx], ...patch, id };
    return this.items[idx];
  }

  replace(id: string, item: T): T | undefined {
    const idx = this.items.findIndex((i) => i.id === id);
    if (idx < 0) return undefined;
    this.items[idx] = { ...item, id };
    return this.items[idx];
  }

  remove(id: string): boolean {
    const before = this.items.length;
    this.items = this.items.filter((i) => i.id !== id);
    return this.items.length < before;
  }

  removeMany(ids: string[]): number {
    const idSet = new Set(ids);
    const before = this.items.length;
    this.items = this.items.filter((i) => !idSet.has(i.id));
    return before - this.items.length;
  }
}

class Store {
  users = new Collection<User>('users', ['name', 'email']);
  leads = new Collection<Lead>('leads', ['name', 'company', 'email']);
  contacts = new Collection<Contact>('contacts', ['name', 'email']);
  accounts = new Collection<Account>('accounts', ['name']);
  deals = new Collection<Deal>('deals', ['name']);
  products = new Collection<Product>('products', ['name', 'sku']);
  tickets = new Collection<Ticket>('tickets', ['subject']);
  campaigns = new Collection<Campaign>('campaigns', ['name']);
  quotes = new Collection<Quote>('quotes', ['quoteNumber']);
  tasks = new Collection<TaskItem>('tasks', ['title']);
  activities = new Collection<Activity>('activities', []);
  notifications = new Collection<AppNotification>('notifications', []);
  customFieldDefs = new Collection<CustomFieldDef>('customFieldDefs', []);
  layouts = new Collection<LayoutDef>('layouts', []);
  audit = new Collection<AuditEntry>('audit', []);

  private auditCounter = 0;

  reset() {
    const data = buildSeedData();
    this.users.seed(data.users);
    this.leads.seed(data.leads);
    this.contacts.seed(data.contacts);
    this.accounts.seed(data.accounts);
    this.deals.seed(data.deals);
    this.products.seed(data.products);
    this.tickets.seed(data.tickets);
    this.campaigns.seed(data.campaigns);
    this.quotes.seed(data.quotes);
    this.tasks.seed(data.tasks);
    this.activities.seed(data.activities);
    this.notifications.seed(data.notifications);
    this.customFieldDefs.seed(data.customFieldDefs);
    this.layouts.seed(data.layouts);
    this.audit.seed(data.audit);
    this.auditCounter = 0;
  }

  logAudit(user: string, action: string, detail: string) {
    const entry: AuditEntry = {
      id: `audit-${Date.now()}-${this.auditCounter++}`,
      user,
      action,
      detail,
      when: new Date().toISOString(),
    };
    this.audit.create(entry);
    // Cap at 200 entries, oldest trimmed — mirrors the client's original behavior.
    const all = this.audit.all();
    if (all.length > 200) {
      const toRemove = all.slice(200).map((e) => e.id);
      this.audit.removeMany(toRemove);
    }
    return entry;
  }
}

export const store = new Store();
store.reset();

let idCounter = 0;
export function newId(prefix: string) {
  return `${prefix}-${Date.now()}-${idCounter++}`;
}
