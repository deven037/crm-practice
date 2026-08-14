// Server-side port of ../../src/data/seed.ts — same mulberry32 PRNG, same shapes/counts,
// kept in sync manually. This is the server's deterministic seed generator, used both
// on boot and by POST /api/reset.
import {
  Account,
  Activity,
  AppNotification,
  AssignmentRule,
  AutoFlowEdge,
  AutoFlowNode,
  AutoFlowProcess,
  Campaign,
  CampaignStatus,
  CAMPAIGN_CHANNELS,
  CAMPAIGN_STATUSES,
  Contact,
  CustomFieldDef,
  CUSTOM_FIELD_MODULES,
  CustomFieldModule,
  Deal,
  DEAL_STAGES,
  DedupeRule,
  LayoutDef,
  Lead,
  LEAD_SOURCES,
  LEAD_STATUSES,
  PageLayout,
  Product,
  Quote,
  QuoteLineItem,
  QUOTE_STATUSES,
  RoleDef,
  SlaConfig,
  StatusCodeSet,
  TaskItem,
  Ticket,
  User,
} from './types.js';

function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let rand = mulberry32(42);
const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];
const between = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;

const FIRST_NAMES = ['Aarav', 'Meera', 'Rohan', 'Ishita', 'Kabir', 'Ananya', 'Vivaan', 'Diya', 'Arjun', 'Sara', 'Dev', 'Naina', 'Yash', 'Kiara', 'Aditya', 'Zoya', 'Karan', 'Tara', 'Nikhil', 'Rhea'];
const LAST_NAMES = ['Sharma', 'Verma', 'Iyer', 'Kapoor', 'Reddy', 'Nair', 'Mehta', 'Bose', 'Gill', 'Rao', 'Joshi', 'Malhotra', 'Desai', 'Chawla', 'Singh', 'Menon'];
const COMPANIES = ['Zenith Corp', 'BlueOak Labs', 'Nimbus Tech', 'Vertex Solutions', 'Solaris Systems', 'Crestline Inc', 'PixelForge', 'Quantica', 'Northwind Traders', 'Aurora Analytics', 'Helix Digital', 'Stratus Cloud', 'Ironleaf Media', 'Coral Peak', 'Silverline Bank', 'Trailhead Retail', 'Orbita Logistics', 'GreenGrid Energy', 'Marble Health', 'Kite Financial'];
const INDUSTRIES = ['Technology', 'Finance', 'Healthcare', 'Retail', 'Manufacturing', 'Energy', 'Logistics', 'Media'];
const TITLES = ['CEO', 'CTO', 'VP Sales', 'Product Manager', 'Marketing Head', 'Procurement Lead', 'IT Director', 'Operations Manager'];
const TAGS = ['vip', 'newsletter', 'partner', 'decision-maker', 'follow-up', 'imported'];
const TASK_TITLES = ['Call back', 'Send proposal to', 'Schedule demo with', 'Follow up with', 'Prepare quote for', 'Review contract for', 'Email onboarding docs to', 'Check renewal for'];
const TICKET_SUBJECTS = ['Cannot login to portal', 'Invoice mismatch for last month', 'Dashboard loads slowly', 'Feature request: export to Excel', 'Password reset not working', 'Duplicate records after import', 'API rate limit questions', 'Mobile app crashes on launch', 'Billing address update', 'Report totals look wrong', 'SSO configuration help', 'Data sync delayed', 'Broken link in welcome email', 'Upgrade plan enquiry', 'Notification emails not received'];

const DAY = 24 * 60 * 60 * 1000;
const now = () => Date.now();
const daysAgo = (d: number) => new Date(now() - d * DAY).toISOString();
const daysFromNow = (d: number) => new Date(now() + d * DAY).toISOString();

function fullName(i: number) {
  return `${FIRST_NAMES[i % FIRST_NAMES.length]} ${LAST_NAMES[(i * 7 + 3) % LAST_NAMES.length]}`;
}

function emailFor(name: string, domain = 'example.com') {
  return `${name.toLowerCase().replace(/[^a-z]+/g, '.')}@${domain}`;
}

function phone() {
  return `+91 98${between(100, 999)} ${between(10000, 99999)}`;
}

export const SEED_USERS: User[] = [
  { id: 'user-1', name: 'Alex Admin', email: 'admin@crm.com', password: 'Pass@123', role: 'admin', active: true },
  { id: 'user-2', name: 'Riya Rep', email: 'rep@crm.com', password: 'Pass@123', role: 'rep', active: true },
  { id: 'user-3', name: 'Vik Viewer', email: 'viewer@crm.com', password: 'Pass@123', role: 'viewer', active: true },
  { id: 'user-4', name: 'Sam Sales', email: 'sam@crm.com', password: 'Pass@123', role: 'rep', active: true },
  { id: 'user-5', name: 'Priya Patel', email: 'priya@crm.com', password: 'Pass@123', role: 'rep', active: false },
];

const OWNER_IDS = ['user-1', 'user-2', 'user-4', 'user-5'];

function seedAccounts(): Account[] {
  return COMPANIES.map((name, i) => ({
    id: `account-${i + 1}`,
    name,
    industry: pick(INDUSTRIES),
    employees: between(10, 5000),
    revenue: between(1, 500) * 100000,
    website: `https://www.${name.toLowerCase().replace(/[^a-z]+/g, '')}.example.com`,
    phone: phone(),
    ownerId: pick(OWNER_IDS),
    createdAt: daysAgo(between(30, 400)),
  }));
}

const PRODUCT_CATALOG: [string, string, number][] = [
  ['CRM Starter Plan', 'Subscription', 4900],
  ['CRM Professional Plan', 'Subscription', 14900],
  ['CRM Enterprise Plan', 'Subscription', 49900],
  ['Onboarding Package', 'Service', 25000],
  ['Data Migration Service', 'Service', 40000],
  ['Premium Support (Annual)', 'Service', 18000],
  ['API Access Add-on', 'Add-on', 9900],
  ['Analytics Module', 'Add-on', 19900],
  ['Marketing Automation Add-on', 'Add-on', 29900],
  ['Mobile App License', 'License', 7900],
  ['Admin Training Workshop', 'Training', 12000],
  ['Custom Integration Build', 'Service', 75000],
];

function seedProducts(): Product[] {
  return PRODUCT_CATALOG.map(([name, category, price], i) => ({
    id: `product-${i + 1}`,
    name,
    sku: `PRD-${String(i + 1).padStart(3, '0')}`,
    category,
    price,
    description: `${name} — ${category.toLowerCase()} offering for CRM customers.`,
    active: i % 7 !== 6,
    createdAt: daysAgo(between(5, 300)),
  }));
}

function seedLeads(products: Product[]): Lead[] {
  const leads: Lead[] = [];
  for (let i = 0; i < 50; i++) {
    const name = fullName(i);
    leads.push({
      id: `lead-${i + 1}`,
      name,
      company: pick(COMPANIES),
      email: emailFor(name),
      phone: phone(),
      status: LEAD_STATUSES[i % 4],
      source: pick(LEAD_SOURCES),
      ownerId: pick(OWNER_IDS),
      value: between(5, 90) * 1000,
      productId: rand() > 0.25 ? pick(products).id : null,
      createdAt: daysAgo(between(0, 120)),
    });
  }
  return leads;
}

function seedContacts(accounts: Account[]): Contact[] {
  const contacts: Contact[] = [];
  for (let i = 0; i < 40; i++) {
    const name = fullName(i + 20);
    const tagCount = between(0, 3);
    const tags: string[] = [];
    for (let t = 0; t < tagCount; t++) {
      const tag = pick(TAGS);
      if (!tags.includes(tag)) tags.push(tag);
    }
    contacts.push({
      id: `contact-${i + 1}`,
      name,
      email: emailFor(name),
      phone: phone(),
      accountId: rand() > 0.15 ? pick(accounts).id : null,
      title: pick(TITLES),
      tags,
      avatar: null,
      notes:
        i % 3 === 0
          ? [{ id: `note-${i}-1`, text: 'Met at the annual trade show. Interested in the enterprise plan.', createdAt: daysAgo(between(5, 60)) }]
          : [],
      files: [],
      createdAt: daysAgo(between(0, 300)),
    });
  }
  return contacts;
}

function seedDeals(accounts: Account[]): Deal[] {
  const deals: Deal[] = [];
  for (let i = 0; i < 25; i++) {
    const stage = DEAL_STAGES[i % DEAL_STAGES.length];
    deals.push({
      id: `deal-${i + 1}`,
      name: `${pick(COMPANIES).split(' ')[0]} ${pick(['Renewal', 'Expansion', 'New Business', 'Upgrade', 'Pilot'])}`,
      accountId: pick(accounts).id,
      amount: between(10, 250) * 1000,
      stage,
      closeDate: stage.startsWith('Closed') ? daysAgo(between(1, 90)) : daysFromNow(between(5, 90)),
      probability: stage === 'Closed Won' ? 100 : stage === 'Closed Lost' ? 0 : between(2, 18) * 5,
      ownerId: pick(OWNER_IDS),
      createdAt: daysAgo(between(10, 200)),
    });
  }
  return deals;
}

function seedTasks(): TaskItem[] {
  const tasks: TaskItem[] = [];
  for (let i = 0; i < 30; i++) {
    tasks.push({
      id: `task-${i + 1}`,
      title: `${pick(TASK_TITLES)} ${fullName(i + 5)}`,
      dueDate: i % 5 === 0 ? daysAgo(between(1, 10)) : daysFromNow(between(0, 21)),
      priority: pick(['Low', 'Medium', 'High'] as const),
      completed: i % 6 === 0,
      order: i,
    });
  }
  return tasks;
}

function seedTickets(): Ticket[] {
  return TICKET_SUBJECTS.map((subject, i) => {
    const status = (['Open', 'In Progress', 'Resolved', 'Closed'] as const)[i % 4];
    const requester = fullName(i + 40);
    return {
      id: `ticket-${i + 1}`,
      subject,
      description: `Reported by ${requester}: "${subject}". Please investigate and update the customer.`,
      requester,
      priority: pick(['Low', 'Medium', 'High', 'Urgent'] as const),
      status,
      slaDue: status === 'Open' || status === 'In Progress' ? new Date(now() + between(1, 72) * 60 * 60 * 1000).toISOString() : daysAgo(between(1, 10)),
      createdAt: daysAgo(between(0, 30)),
      comments:
        i % 2 === 0
          ? [{ id: `tcomment-${i}-1`, author: 'Riya Rep', text: 'Acknowledged, looking into this now.', createdAt: daysAgo(between(0, 5)) }]
          : [],
      attachments: [],
    };
  });
}

function seedActivities(): Activity[] {
  const actions: [string, string][] = [
    ['📞', 'called'],
    ['✉️', 'emailed'],
    ['📅', 'scheduled a meeting with'],
    ['💰', 'updated a deal for'],
    ['📝', 'added a note for'],
    ['✅', 'completed a task for'],
  ];
  const activities: Activity[] = [];
  for (let i = 0; i < 60; i++) {
    const [icon, verb] = pick(actions);
    activities.push({
      id: `activity-${i + 1}`,
      icon,
      text: `${pick(SEED_USERS).name} ${verb} ${fullName(i)} (${pick(COMPANIES)})`,
      when: new Date(now() - i * 6 * 60 * 60 * 1000 - between(0, 300) * 60 * 1000).toISOString(),
    });
  }
  return activities;
}

function seedNotifications(): AppNotification[] {
  return [
    { id: 'notif-1', text: 'Deal "Zenith Renewal" moved to Negotiation', read: false, when: daysAgo(0) },
    { id: 'notif-2', text: 'New lead assigned to you: Aarav Sharma', read: false, when: daysAgo(1) },
    { id: 'notif-3', text: 'Ticket #ticket-3 breached its SLA', read: false, when: daysAgo(1) },
    { id: 'notif-4', text: 'Weekly pipeline report is ready', read: true, when: daysAgo(3) },
    { id: 'notif-5', text: 'Priya Patel was deactivated by Alex Admin', read: true, when: daysAgo(6) },
  ];
}

const CAMPAIGN_NAMES = [
  'Spring Product Launch',
  'LinkedIn Lead Gen Push',
  'Webinar Series: CRM Best Practices',
  'Partner Co-Marketing Q2',
  'Retargeting Ad Blitz',
  'Trade Show — SaaSCon',
  'Content Hub Relaunch',
  'Customer Referral Drive',
];

function seedCampaigns(): Campaign[] {
  return CAMPAIGN_NAMES.map((name, i) => {
    const startOffsetDays = between(30, 200);
    const durationDays = between(14, 90);
    const start = new Date(now() - startOffsetDays * DAY);
    const end = new Date(start.getTime() + durationDays * DAY);
    let status: CampaignStatus;
    if (end.getTime() < now()) status = pick<CampaignStatus>(['Completed', 'Cancelled']);
    else if (start.getTime() > now()) status = 'Planned';
    else status = 'Active';
    return {
      id: `campaign-${i + 1}`,
      name,
      channel: pick(CAMPAIGN_CHANNELS),
      budget: between(5, 50) * 1000,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      status,
      createdAt: daysAgo(startOffsetDays + between(0, 5)),
    };
  });
}

function attachCampaignsToLeads(leads: Lead[], campaigns: Campaign[]): Lead[] {
  return leads.map((l) => ({ ...l, campaignId: rand() > 0.4 ? pick(campaigns).id : null }));
}

function seedQuotes(accounts: Account[], deals: Deal[], products: Product[]): Quote[] {
  const quotes: Quote[] = [];
  for (let i = 0; i < 15; i++) {
    const account = pick(accounts);
    const accountDeals = deals.filter((d) => d.accountId === account.id);
    const dealId = accountDeals.length > 0 && rand() > 0.35 ? pick(accountDeals).id : null;
    const lineItemCount = between(1, 4);
    const lineItems: QuoteLineItem[] = [];
    for (let j = 0; j < lineItemCount; j++) {
      const product = pick(products);
      lineItems.push({
        id: `qline-${i}-${j}`,
        productId: product.id,
        productName: product.name,
        quantity: between(1, 5),
        unitPrice: product.price,
        discountPct: pick([0, 5, 10, 15, 20]),
      });
    }
    quotes.push({
      id: `quote-${i + 1}`,
      quoteNumber: `Q-2026-${String(i + 1).padStart(4, '0')}`,
      accountId: account.id,
      dealId,
      lineItems,
      status: pick(QUOTE_STATUSES),
      validUntil: daysFromNow(between(7, 60)),
      createdAt: daysAgo(between(1, 120)),
    });
  }
  return quotes;
}

function seedCustomFieldDefs(): CustomFieldDef[] {
  return [
    {
      id: 'cf-lead-referral',
      module: 'leads',
      key: 'referral_source',
      label: 'Referral Source',
      type: 'text',
      required: false,
      createdAt: daysAgo(60),
    },
    {
      id: 'cf-lead-risk',
      module: 'leads',
      key: 'renewal_risk',
      label: 'Renewal Risk',
      type: 'dropdown',
      options: ['Low', 'Medium', 'High'],
      required: false,
      createdAt: daysAgo(60),
    },
    {
      id: 'cf-account-contract',
      module: 'accounts',
      key: 'contract_type',
      label: 'Contract Type',
      type: 'dropdown',
      options: ['Annual', 'Monthly'],
      required: false,
      createdAt: daysAgo(60),
    },
  ];
}

// Mirrors today's 3 real permission tiers (Role union in types.ts) as a directory entry
// only — isSystem rows are non-deletable and never consulted by requireRole/Protected.
function seedRoleDefs(): RoleDef[] {
  return [
    { id: 'role-admin', name: 'Admin', description: 'Full access to all records and Setup.', isSystem: true },
    { id: 'role-rep', name: 'Sales Rep', description: 'Can manage records but has read-only Setup access.', isSystem: true },
    { id: 'role-viewer', name: 'Viewer', description: 'Read-only access across all modules.', isSystem: true },
  ];
}

// Genuinely new features (no prior hardcoded behavior to preserve) — seeded active with a
// realistic example so Setup shows working data, not an empty state.
function seedAssignmentRules(): AssignmentRule[] {
  return [
    {
      id: 'assign-web-leads',
      module: 'leads',
      name: 'Web leads → Riya Rep',
      active: true,
      conditions: [{ field: 'source', operator: 'equals', value: 'Web' }],
      assignTo: 'user-2',
      priority: 1,
    },
    {
      id: 'assign-referral-leads',
      module: 'leads',
      name: 'Referral leads → Sam Sales',
      active: false,
      conditions: [{ field: 'source', operator: 'equals', value: 'Referral' }],
      assignTo: 'user-4',
      priority: 2,
    },
  ];
}

function seedDedupeRules(): DedupeRule[] {
  return [
    { id: 'dedupe-leads-email', module: 'leads', name: 'Match leads by email', active: true, matchFields: ['email'], matchType: 'exact' },
    {
      id: 'dedupe-contacts-email',
      module: 'contacts',
      name: 'Match contacts by email',
      active: true,
      matchFields: ['email'],
      matchType: 'exact',
    },
  ];
}

// isSystem: true rows reproduce today's hardcoded option lists exactly (LEAD_STATUSES,
// DEAL_STAGES, CAMPAIGN_STATUSES, CAMPAIGN_CHANNELS) so wiring the relevant <Select>s up
// to read from here is a no-op until someone actually edits a set.
function seedStatusCodeSets(): StatusCodeSet[] {
  return [
    { id: 'status-lead-status', module: 'leads', field: 'status', name: 'Lead Status', options: [...LEAD_STATUSES], isSystem: true },
    { id: 'status-deal-stage', module: 'deals', field: 'stage', name: 'Deal Stage', options: [...DEAL_STAGES], isSystem: true },
    {
      id: 'status-campaign-status',
      module: 'campaigns',
      field: 'status',
      name: 'Campaign Status',
      options: [...CAMPAIGN_STATUSES],
      isSystem: true,
    },
    {
      id: 'status-campaign-channel',
      module: 'campaigns',
      field: 'channel',
      name: 'Campaign Channel',
      options: [...CAMPAIGN_CHANNELS],
      isSystem: true,
    },
  ];
}

// Every priority at 48h — matches today's flat `now + 48h` computation in TicketForm.tsx
// exactly, so switching tickets to config-driven SLA hours is a no-op until edited.
function seedSlaConfigs(): SlaConfig[] {
  return [
    { id: 'sla-low', priority: 'Low', hours: 48 },
    { id: 'sla-medium', priority: 'Medium', hours: 48 },
    { id: 'sla-high', priority: 'High', hours: 48 },
    { id: 'sla-urgent', priority: 'Urgent', hours: 48 },
  ];
}

function seedLayouts(): LayoutDef[] {
  return [
    { id: 'layout-leads-form', module: 'leads', target: 'form', fieldIds: ['cf-lead-referral', 'cf-lead-risk'] },
    { id: 'layout-leads-detail', module: 'leads', target: 'detail', fieldIds: ['cf-lead-referral', 'cf-lead-risk'] },
    { id: 'layout-accounts-form', module: 'accounts', target: 'form', fieldIds: ['cf-account-contract'] },
    { id: 'layout-accounts-detail', module: 'accounts', target: 'detail', fieldIds: ['cf-account-contract'] },
  ];
}

// One isSystem "Default" PageLayout per module — field keys mirror each module's core
// system fields (see client src/utils/moduleFields.ts, kept in sync manually). Purely a
// config-preview surface for now; not yet read by any real Form/Detail page.
const DEFAULT_LAYOUT_FIELDS: Record<CustomFieldModule, string[]> = {
  leads: ['name', 'company', 'email', 'phone', 'status', 'source', 'value', 'ownerId'],
  contacts: ['name', 'email', 'phone', 'title', 'accountId'],
  accounts: ['name', 'industry', 'employees', 'revenue', 'website', 'phone', 'ownerId'],
  deals: ['name', 'accountId', 'amount', 'stage', 'probability', 'closeDate', 'ownerId'],
  products: ['name', 'sku', 'category', 'price', 'description', 'active'],
  tickets: ['subject', 'requester', 'priority', 'description'],
  campaigns: ['name', 'channel', 'budget', 'status', 'startDate', 'endDate'],
  quotes: ['quoteNumber', 'accountId', 'validUntil'],
};

function seedPageLayouts(): PageLayout[] {
  return CUSTOM_FIELD_MODULES.map((module) => ({
    id: `layout-default-${module}`,
    module,
    name: 'Default',
    isDefault: true,
    tabs: [{ id: `tab-details-${module}`, label: 'Details', fieldKeys: DEFAULT_LAYOUT_FIELDS[module] }],
  }));
}

// One example published AutoFlow process, tied to the first seeded product, exercising
// start/state/decision/wait/end node types and a true/false branch — demonstrates the
// canvas designer (Phase 2+) with real, non-empty data out of the box.
function seedAutoFlowProcesses(products: Product[]): AutoFlowProcess[] {
  const lane = { id: 'lane-sales', label: 'Sales Team', order: 0 };
  const milestones = [
    { id: 'milestone-intake', label: 'Intake', order: 0 },
    { id: 'milestone-qualification', label: 'Qualification', order: 1 },
    { id: 'milestone-assignment', label: 'Assignment', order: 2 },
  ];

  const nodes: AutoFlowNode[] = [
    { id: 'af-start', type: 'start', position: { x: 40, y: 80 }, laneId: lane.id, milestoneId: 'milestone-intake', data: { label: 'Start' } },
    {
      id: 'af-screen',
      type: 'state',
      position: { x: 260, y: 80 },
      laneId: lane.id,
      milestoneId: 'milestone-intake',
      data: { label: 'Screen', fieldKeys: ['name', 'email', 'phone'] },
    },
    {
      id: 'af-dedupe',
      type: 'state',
      position: { x: 480, y: 80 },
      laneId: lane.id,
      milestoneId: 'milestone-intake',
      data: { label: 'De-dupe Check', action: 'dedupe' },
    },
    {
      id: 'af-web-source',
      type: 'decision',
      position: { x: 700, y: 80 },
      laneId: lane.id,
      milestoneId: 'milestone-qualification',
      data: { label: 'Web Source?', condition: { field: 'source', operator: 'equals', value: 'Web' } },
    },
    {
      id: 'af-assign',
      type: 'state',
      position: { x: 920, y: 20 },
      laneId: lane.id,
      milestoneId: 'milestone-assignment',
      data: { label: 'Assign Rep', action: 'assign' },
    },
    {
      id: 'af-cooldown',
      type: 'wait',
      position: { x: 1140, y: 20 },
      laneId: lane.id,
      milestoneId: 'milestone-assignment',
      data: { label: 'Cooldown', waitMinutes: 30 },
    },
    {
      id: 'af-manual-review',
      type: 'state',
      position: { x: 920, y: 160 },
      laneId: lane.id,
      milestoneId: 'milestone-assignment',
      data: { label: 'Manual Review' },
    },
    { id: 'af-end', type: 'end', position: { x: 1360, y: 80 }, laneId: lane.id, milestoneId: 'milestone-assignment', data: { label: 'End' } },
  ];

  const edges: AutoFlowEdge[] = [
    { id: 'af-e-start-screen', source: 'af-start', target: 'af-screen' },
    { id: 'af-e-screen-dedupe', source: 'af-screen', target: 'af-dedupe' },
    { id: 'af-e-dedupe-decision', source: 'af-dedupe', target: 'af-web-source' },
    {
      id: 'af-e-decision-assign',
      source: 'af-web-source',
      target: 'af-assign',
      sourceHandle: 'true',
      branchLabel: 'Web lead',
      condition: { field: 'source', operator: 'equals', value: 'Web' },
    },
    {
      id: 'af-e-decision-review',
      source: 'af-web-source',
      target: 'af-manual-review',
      sourceHandle: 'false',
      branchLabel: 'Other source',
    },
    { id: 'af-e-assign-cooldown', source: 'af-assign', target: 'af-cooldown' },
    { id: 'af-e-cooldown-end', source: 'af-cooldown', target: 'af-end' },
    { id: 'af-e-review-end', source: 'af-manual-review', target: 'af-end' },
  ];

  return [
    {
      id: 'autoflow-example-1',
      name: `New Process — ${products[0]?.name ?? 'Product'}`,
      productId: products[0]?.id ?? 'product-1',
      allowedRoles: ['admin', 'rep'],
      targetModule: 'leads',
      status: 'published',
      lanes: [lane],
      milestones,
      nodes,
      edges,
      createdAt: daysAgo(14),
      updatedAt: daysAgo(2),
    },
  ];
}

const REFERRAL_SOURCES_EXAMPLE = [
  'Friend of customer',
  'Conference badge scan',
  'Partner intro',
  'Cold LinkedIn outreach',
  'Existing customer referral',
];
const RENEWAL_RISKS_EXAMPLE = ['Low', 'Medium', 'High'];
const CONTRACT_TYPES_EXAMPLE = ['Annual', 'Monthly'];

function applyCustomFieldExamples(leads: Lead[], accounts: Account[]) {
  for (let i = 0; i < 5 && i < leads.length; i++) {
    leads[i].customFields = {
      referral_source: REFERRAL_SOURCES_EXAMPLE[i % REFERRAL_SOURCES_EXAMPLE.length],
      renewal_risk: RENEWAL_RISKS_EXAMPLE[i % RENEWAL_RISKS_EXAMPLE.length],
    };
  }
  for (let i = 0; i < 5 && i < accounts.length; i++) {
    accounts[i].customFields = {
      contract_type: CONTRACT_TYPES_EXAMPLE[i % CONTRACT_TYPES_EXAMPLE.length],
    };
  }
}

export function buildSeedData() {
  rand = mulberry32(42);
  const accounts = seedAccounts();
  const products = seedProducts();
  const leads = seedLeads(products);
  const contacts = seedContacts(accounts);
  const deals = seedDeals(accounts);
  const tasks = seedTasks();
  const tickets = seedTickets();
  const activities = seedActivities();
  const notifications = seedNotifications();

  const campaigns = seedCampaigns();
  const leadsWithCampaigns = attachCampaignsToLeads(leads, campaigns);
  const quotes = seedQuotes(accounts, deals, products);
  const customFieldDefs = seedCustomFieldDefs();
  const layouts = seedLayouts();
  const pageLayouts = seedPageLayouts();
  const roleDefs = seedRoleDefs();
  const assignmentRules = seedAssignmentRules();
  const dedupeRules = seedDedupeRules();
  const statusCodeSets = seedStatusCodeSets();
  const slaConfigs = seedSlaConfigs();
  const autoFlowProcesses = seedAutoFlowProcesses(products);
  applyCustomFieldExamples(leadsWithCampaigns, accounts);

  return {
    users: [...SEED_USERS], // copy — SEED_USERS is a shared module-level constant, never hand out the live reference
    accounts,
    products,
    leads: leadsWithCampaigns,
    contacts,
    deals,
    tasks,
    tickets,
    activities,
    notifications,
    campaigns,
    quotes,
    customFieldDefs,
    layouts,
    pageLayouts,
    roleDefs,
    assignmentRules,
    dedupeRules,
    statusCodeSets,
    slaConfigs,
    autoFlowProcesses,
    audit: [
      { id: 'audit-1', user: 'Alex Admin', action: 'seed', detail: 'Database seeded with sample data', when: new Date().toISOString() },
    ] as { id: string; user: string; action: string; detail: string; when: string }[],
  };
}
