import { buildSeedData } from './seed.js';
import { currentBankStore } from './context.js';
import { demoPasswordHash } from './passwords.js';
import {
  Account,
  Activity,
  Meeting,
  AppNotification,
  AssignmentRule,
  AuditEntry,
  AutoFlowProcess,
  Campaign,
  Contact,
  CustomFieldDef,
  Deal,
  DedupeRule,
  LayoutDef,
  Lead,
  PageLayout,
  Product,
  Quote,
  QuoteSettings,
  DashboardLayout,
  SearchHistory,
  RoleDef,
  SlaConfig,
  SlaRules,
  StatusCodeSet,
  SetupDraft,
  SetupVersion,
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
    // Copy, don't alias — some seed sources (e.g. SEED_USERS in seed.ts) are shared
    // module-level constants reused across every reset. Storing the same reference
    // here would let create()'s in-place unshift() permanently mutate that constant,
    // so every future "reset" would faithfully restore an already-polluted seed.
    this.items = [...items];
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

/** Every collection a bank has, by name. tenancy.ts loads and saves exactly these. */
export const COLLECTION_NAMES = [
  'users', 'leads', 'contacts', 'accounts', 'deals', 'products', 'tickets', 'campaigns', 'quotes', 'tasks', 'meetings',
  'activities', 'notifications', 'customFieldDefs', 'layouts', 'pageLayouts', 'roleDefs', 'assignmentRules',
  'setupDrafts', 'setupVersions',
  'dedupeRules', 'statusCodeSets', 'slaConfigs', 'slaRules', 'quoteSettings', 'dashboardLayouts', 'searchHistory', 'autoFlowProcesses', 'audit',
] as const;
export type CollectionName = (typeof COLLECTION_NAMES)[number];

/** One bank's data. A separate Store exists per bank; they never share a collection. */
export class Store {
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
  meetings = new Collection<Meeting>('meetings', ['title']);
  activities = new Collection<Activity>('activities', []);
  notifications = new Collection<AppNotification>('notifications', []);
  customFieldDefs = new Collection<CustomFieldDef>('customFieldDefs', []);
  layouts = new Collection<LayoutDef>('layouts', []);
  pageLayouts = new Collection<PageLayout>('pageLayouts', ['name']);
  roleDefs = new Collection<RoleDef>('roleDefs', ['name']);
  assignmentRules = new Collection<AssignmentRule>('assignmentRules', ['name']);
  dedupeRules = new Collection<DedupeRule>('dedupeRules', ['name']);
  statusCodeSets = new Collection<StatusCodeSet>('statusCodeSets', ['name']);
  setupDrafts = new Collection<SetupDraft>('setupDrafts');
  setupVersions = new Collection<SetupVersion>('setupVersions');
  slaConfigs = new Collection<SlaConfig>('slaConfigs', []);
  slaRules = new Collection<SlaRules>('slaRules', []);
  quoteSettings = new Collection<QuoteSettings>('quoteSettings', []);
  dashboardLayouts = new Collection<DashboardLayout>('dashboardLayouts', []);
  searchHistory = new Collection<SearchHistory>('searchHistory', []);
  autoFlowProcesses = new Collection<AutoFlowProcess>('autoFlowProcesses', ['name']);
  audit = new Collection<AuditEntry>('audit', []);

  private auditCounter = 0;

  reset() {
    const data = buildSeedData();
    // The demo bank's users keep the documented demo password, stored as a hash.
    this.users.seed(data.users.map((user) => ({ ...user, password: demoPasswordHash() })));
    this.leads.seed(data.leads);
    this.contacts.seed(data.contacts);
    this.accounts.seed(data.accounts);
    this.deals.seed(data.deals);
    this.products.seed(data.products);
    this.tickets.seed(data.tickets);
    this.campaigns.seed(data.campaigns);
    this.quotes.seed(data.quotes);
    this.tasks.seed(data.tasks);
    this.meetings.seed(data.meetings);
    this.activities.seed(data.activities);
    this.notifications.seed(data.notifications);
    this.customFieldDefs.seed(data.customFieldDefs);
    this.layouts.seed(data.layouts);
    this.pageLayouts.seed(data.pageLayouts);
    this.roleDefs.seed(data.roleDefs);
    this.assignmentRules.seed(data.assignmentRules);
    this.dedupeRules.seed(data.dedupeRules);
    this.statusCodeSets.seed(data.statusCodeSets);
    this.setupDrafts.seed(data.setupDrafts);
    this.setupVersions.seed(data.setupVersions);
    this.slaConfigs.seed(data.slaConfigs);
    this.slaRules.seed(data.slaRules);
    this.quoteSettings.seed(data.quoteSettings);
    this.dashboardLayouts.seed(data.dashboardLayouts);
    this.searchHistory.seed(data.searchHistory);
    this.autoFlowProcesses.seed(data.autoFlowProcesses);
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

/**
 * The store of the bank the current request belongs to (see context.ts). Route files
 * keep using `store.leads`, `store.logAudit(...)` and so on; each call reaches only
 * the signed-in user's bank. With no bank selected it throws.
 */
export const store: Store = new Proxy({} as Store, {
  get(_target, property) {
    if (typeof property === 'string' && property in collectionHandles) return collectionHandles[property];
    const real = currentBankStore() as any;
    const value = real[property];
    return typeof value === 'function' ? value.bind(real) : value;
  },
});

// Route files hold on to a collection when they are first loaded
// (`crudRouter({ collection: store.leads })`), long before any request. So
// `store.leads` is a stand-in that looks up the current bank's leads each time one of
// its methods is called, never a fixed bank's collection.
const collectionHandles: Record<string, unknown> = Object.fromEntries(
  COLLECTION_NAMES.map((name) => [
    name,
    new Proxy({} as Collection<any>, {
      get(_target, property) {
        const real = (currentBankStore() as any)[name];
        const value = real[property];
        return typeof value === 'function' ? value.bind(real) : value;
      },
    }),
  ])
);

let idCounter = 0;
export function newId(prefix: string) {
  return `${prefix}-${Date.now()}-${idCounter++}`;
}
