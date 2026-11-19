// Server-side port of ../../src/data/seed.ts — same mulberry32 PRNG, same shapes/counts,
// kept in sync manually. This is the server's deterministic seed generator, used both
// on boot and by POST /api/reset.
import { DEFAULT_SLA_RULES, duesFor } from './sla.js';
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
  ChargeType,
  Product,
  PRODUCT_CATEGORIES,
  Quote,
  QuoteLineItem,
  QUOTE_REJECT_REASONS,
  QUOTE_STATUSES,
  RoleDef,
  SlaConfig,
  SlaRules,
  QuoteSettings,
  DashboardLayout,
  SearchHistory,
  StatusCodeSet,
  TaskItem,
  Meeting,
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
const TICKET_CHANNELS = ['Email', 'Phone', 'Branch', 'Portal', 'WhatsApp'];
const TICKET_CATEGORIES = ['Payments', 'Cards', 'Net banking', 'Loans', 'Accounts', 'Deposits', 'Forex', 'KYC'];
const CANNED_REPLIES = [
  'Hello {first_name}, thank you for writing to us. I have taken this up and will update you within the hour.',
  'Hello {first_name}, could you share the transaction reference numbers and the date of the failed payments?',
  'Hello {first_name}, this has been fixed on our side. Please try again and tell us if anything still fails.',
  'Hello {first_name}, please visit your home branch with an original ID proof so we can complete this request.',
];
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

// Banking products: name, family, SKU, charge type, earlier prices as [days ago, price] (the last one is today's price),
// on sale, description. Twelve, in a fixed order: later seed data picks from this list with rand().
const PRODUCT_CATALOG: [string, string, string, ChargeType, [number, number][], boolean, string][] = [
  ['Business Current Account Premium', 'Accounts', 'ACC-PRM', 'Monthly', [[410, 1800], [212, 2200], [60, 2500]], true, 'Current account with unlimited domestic transfers, high free cash deposit limits and a named relationship manager.'],
  ['Payroll Account Bundle', 'Accounts', 'ACC-PAY', 'Monthly', [[380, 150]], true, 'Salary accounts for a company’s staff, priced per employee each month. Includes debit cards and bulk salary upload.'],
  ['Corporate Credit Card', 'Cards', 'CRD-CORP', 'Yearly', [[520, 1499], [150, 1999]], true, 'Credit cards for employees with spend limits per card, monthly central billing and expense export.'],
  ['Fleet Fuel Card', 'Cards', 'CRD-FLT', 'Yearly', [[300, 499]], true, 'Fuel cards for vehicles with per-vehicle limits and cashback at partner pumps.'],
  ['POS Terminal Rental', 'Payments', 'PAY-POS', 'Monthly', [[460, 799], [240, 699]], true, 'Card and contactless terminal for shops, priced per terminal each month. Next-day settlement.'],
  ['Payment Gateway Setup', 'Payments', 'PAY-PG', 'One-time', [[350, 15000]], true, 'Online payment gateway set up and tested on the customer’s website or app.'],
  ['Cash Management Service', 'Payments', 'PAY-CMS', 'Monthly', [[600, 10000], [330, 12000]], true, 'Collections, cash pick-up and payouts with daily reports for companies with many branches.'],
  ['Working Capital Processing', 'Lending', 'LND-WC', 'One-time', [[700, 25000]], true, 'Processing fee for a working capital limit: appraisal, documents and set-up.'],
  ['Letter of Credit Issuance', 'Trade', 'TRD-LC', 'One-time', [[640, 6000], [90, 7500]], true, 'Issue fee per import letter of credit, including SWIFT charges.'],
  ['Bank Guarantee Issuance', 'Trade', 'TRD-BG', 'One-time', [[500, 5000]], true, 'Issue fee per bank guarantee, performance or financial.'],
  ['Wealth Advisory Retainer', 'Wealth', 'WLT-ADV', 'Yearly', [[260, 35000]], true, 'Yearly advisory for promoters and their families: investments, insurance and estate planning.'],
  ['Forex Hedging Desk', 'Trade', 'TRD-FX', 'Yearly', [[690, 20000]], false, 'Yearly access to the bank’s hedging desk for forwards and options. No longer sold.'],
];

function seedProducts(): Product[] {
  return PRODUCT_CATALOG.map(([name, category, sku, unit, prices, active, description], i) => {
    // between() is still called once per product so the rand() order of later seed data stays the same.
    const created = Math.max(between(5, 300), prices[0][0]);
    return {
      id: `product-${i + 1}`,
      name,
      sku,
      category,
      price: prices[prices.length - 1][1],
      unit,
      description,
      active,
      createdAt: daysAgo(created),
      priceHistory: prices.map(([ago, price], j) => ({ price, at: daysAgo(j === 0 ? created : ago), by: 'Alex Admin' })),
    };
  });
}

function seedLeads(products: Product[]): Lead[] {
  const leads: Lead[] = [];
  for (let i = 0; i < 75; i++) {
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

export const DEAL_LOST_REASONS = ['Price or rate too high', 'Chose another bank', 'Credit not approved', 'Customer stopped responding', 'Project cancelled', 'Timing, revisit next year', 'Missing documents'];
const DEAL_NEXT_STEPS = ['Send revised pricing', 'Collect audited financials', 'Book a site visit', 'Legal review of the agreement', 'Share the term sheet', 'Intro call with the finance head', 'Draft the credit memo'];

/** The stages a seeded deal walked through to reach where it is, ending at its current stage. */
function seedStageHistory(stage: string, createdAt: string, closeDate: string, by: string, lostReason: string): Deal['stageHistory'] {
  const open = ['Qualification', 'Proposal', 'Negotiation'];
  const reached = stage === 'Closed Won' ? 3 : stage === 'Closed Lost' ? 2 : Math.max(1, open.indexOf(stage) + 1);
  const start = new Date(createdAt).getTime();
  // Some seeded deals close before they were created; their history then runs from creation up to today.
  const close = new Date(closeDate).getTime();
  const end = stage.startsWith('Closed') && close > start ? close : Math.max(start + 1, Date.now() - 24 * 60 * 60 * 1000);
  const step = (end - start) / (reached + 1);
  const events: NonNullable<Deal['stageHistory']> = open.slice(0, reached).map((s, k) => ({ stage: s, at: new Date(start + k * step).toISOString(), by }));
  if (stage.startsWith('Closed')) events.push({ stage, at: new Date(end).toISOString(), by, ...(lostReason ? { note: lostReason } : {}) });
  return events;
}

function seedDeals(accounts: Account[]): Deal[] {
  const deals: Deal[] = [];
  for (let i = 0; i < 25; i++) {
    const stage = DEAL_STAGES[i % DEAL_STAGES.length];
    // The random calls stay in their original order so every seeded record after the deals is unchanged;
    // the new fields come from the row number instead.
    const deal: Deal = {
      id: `deal-${i + 1}`,
      name: `${pick(COMPANIES).split(' ')[0]} ${pick(['Renewal', 'Expansion', 'New Business', 'Upgrade', 'Pilot'])}`,
      accountId: pick(accounts).id,
      amount: between(10, 250) * 1000,
      stage,
      closeDate: stage.startsWith('Closed') ? daysAgo(between(1, 90)) : daysFromNow(between(5, 90)),
      probability: stage === 'Closed Won' ? 100 : stage === 'Closed Lost' ? 0 : between(2, 18) * 5,
      ownerId: pick(OWNER_IDS),
      createdAt: daysAgo(between(10, 200)),
    };
    deal.layoutName = 'Default';
    deal.nextStep = stage.startsWith('Closed') ? '' : DEAL_NEXT_STEPS[i % DEAL_NEXT_STEPS.length];
    deal.lostReason = stage === 'Closed Lost' ? DEAL_LOST_REASONS[i % DEAL_LOST_REASONS.length] : '';
    deal.stageHistory = seedStageHistory(stage, deal.createdAt, deal.closeDate, SEED_USERS.find((u) => u.id === deal.ownerId)?.name ?? 'Alex Admin', deal.lostReason);
    deals.push(deal);
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

/**
 * The demo bank's campaigns: [name, channel, start day, end day (from today), leads wanted, owner, audience,
 * return wanted (won value per rupee spent; 0 = none won)]. Fixed rows so the Campaigns pages always show a
 * running, finished, cancelled and planned campaign; spend and budget are worked out from the won deals.
 */
const CAMPAIGN_PLAN: [string, string, number, number, number, string, string, number][] = [
  ['Festive Business Loans', 'Paid Search', -40, 20, 12, 'user-4', 'Traders and shop owners stocking up for the festive season', 3.4],
  ['Payroll Switch Webinars', 'Webinar', -25, 35, 15, 'user-2', 'HR and finance heads at firms with 50 to 500 staff', 2.1],
  ['Merchant POS on LinkedIn', 'Social Media', -10, 50, 20, 'user-2', 'Retail chains and restaurants with five or more outlets', 0],
  ['Trade Finance Expo Mumbai', 'Trade Show', -112, -108, 6, 'user-4', 'Importers and exporters visiting the Mumbai expo', 5.8],
  ['Corporate Cards Email Series', 'Email', -130, -70, 8, 'user-1', 'Finance teams of existing current-account customers', 8.5],
  ['CA Partner Referral Club', 'Partner Referral', -60, 90, 10, 'user-4', 'Chartered accountants who advise SME clients', 0.8],
  ['Summer Savings Social Blitz', 'Social Media', -135, -100, 12, 'user-1', 'Salaried savers aged 25 to 40', 0],
  ['New Year Cash Management Push', 'Email', 35, 75, 15, 'user-2', 'Mid-size companies with several collection accounts', 0],
];
/** Days from today the cancelled campaign was stopped. */
const CAMPAIGN_CANCELLED_AT = -110;

const dayStart = (d: number) => { const t = new Date(now() + d * DAY); t.setHours(0, 0, 0, 0); return t; };
const dayEnd = (d: number) => { const t = new Date(now() + d * DAY); t.setHours(23, 59, 0, 0); return t; };

function seedCampaigns(): Campaign[] {
  return CAMPAIGN_PLAN.map(([name, channel, s, e, target, ownerId, audience], i) => {
    // The random calls stay in their original order so every seeded record after the campaigns is unchanged;
    // the campaign itself comes from the fixed plan above.
    const startOffsetDays = between(30, 200);
    const durationDays = between(14, 90);
    if (now() - startOffsetDays * DAY + durationDays * DAY < now()) pick<CampaignStatus>(['Completed', 'Cancelled']);
    pick(CAMPAIGN_CHANNELS);
    between(5, 50);
    between(0, 5);
    const status: CampaignStatus = i === 6 ? 'Cancelled' : s > 0 ? 'Planned' : e < 0 ? 'Completed' : 'Active';
    return {
      id: `campaign-${i + 1}`,
      name,
      channel,
      budget: 0, // set by finishCampaigns
      startDate: dayStart(s).toISOString(),
      endDate: dayEnd(e).toISOString(),
      status,
      createdAt: dayStart(s - 14 - i).toISOString(),
      layoutName: 'Default',
      ownerId,
      audience,
      targetLeads: target,
      spent: 0,
      spendLog: [],
      cancelReason: status === 'Cancelled' ? 'Results too low for the spend' : null,
      history: [],
    };
  });
}

const roundTo = (n: number, step: number) => Math.max(step, Math.round(n / step) * step);

/**
 * Links deals to the campaigns, then sets each campaign's spend, budget, spend log and history so its return is
 * close to the plan's. No rand() here, so the rest of the seed stays the same.
 */
function finishCampaigns(campaigns: Campaign[], leads: Lead[], deals: Deal[]): void {
  const started = campaigns.slice(0, 6);
  // Won deals: one each for the campaigns that have a return in the plan.
  const wonFor = campaigns.filter((_, i) => CAMPAIGN_PLAN[i][7] > 0);
  deals.filter((d) => d.stage === 'Closed Won').forEach((d, k) => { d.campaignId = wonFor[k % wonFor.length].id; });
  deals.forEach((d, i) => { if (d.stage !== 'Closed Won' && i % 4 === 0) d.campaignId = started[(i / 4) % started.length].id; });
  // A planned campaign has not reached anyone yet.
  const planned = campaigns.filter((c) => c.status === 'Planned').map((c) => c.id);
  leads.forEach((l) => { if (l.campaignId && planned.includes(l.campaignId)) l.campaignId = 'campaign-3'; });

  const owner = (id: string | null | undefined) => SEED_USERS.find((u) => u.id === id)?.name ?? 'Alex Admin';
  campaigns.forEach((c, i) => {
    const [, , s, e, , , , ret] = CAMPAIGN_PLAN[i];
    const won = deals.filter((d) => d.campaignId === c.id && d.stage === 'Closed Won').reduce((t, d) => t + d.amount, 0);
    const len = e - s + 1;
    const share = c.status === 'Active' ? Math.min(1, (1 - s) / len) * (0.9 + (i % 3) * 0.1) : c.status === 'Completed' ? 0.96 : 0;
    let spent = 0;
    let budget = 0;
    if (c.status === 'Planned') budget = 60_000;
    else if (c.status === 'Cancelled') { spent = 30_000; budget = 80_000; }
    else if (ret > 0 && won > 0) { spent = roundTo(won / ret, 1000); budget = roundTo(spent / share, 1000); }
    else { budget = 90_000; spent = roundTo(budget * share * 0.6, 1000); }
    c.budget = budget;
    c.spent = spent;

    const by = owner(c.ownerId);
    const history = [{ at: c.createdAt, by, text: 'Created' }] as NonNullable<Campaign['history']>;
    if (c.status !== 'Planned') history.push({ at: c.startDate, by: 'System', text: 'Started on its start date' });
    // Spend in two to four payments across the part of the run that has gone.
    const lastDay = c.status === 'Cancelled' ? CAMPAIGN_CANCELLED_AT : Math.min(0, e);
    const parts = spent ? Math.max(1, Math.min(2 + (i % 3), Math.floor(spent / 2000))) : 0;
    let left = spent;
    const log: NonNullable<Campaign['spendLog']> = [];
    for (let p = 0; p < parts; p++) {
      const amount = p === parts - 1 ? left : roundTo(spent / parts, 1000);
      left -= amount;
      const at = dayStart(s + Math.round(((lastDay - s) * (p + 1)) / (parts + 0.5))).toISOString();
      const note = ['Agency invoice', 'Media booking', 'Event and travel', 'Creative and printing'][(i + p) % 4];
      log.push({ amount, at, by, note });
      history.push({ at, by, text: `Spend logged: ${note}`, amount });
    }
    c.spendLog = log;
    if (c.status === 'Completed') history.push({ at: c.endDate, by: 'System', text: 'Ended on its end date' });
    if (c.status === 'Cancelled') history.push({ at: dayStart(CAMPAIGN_CANCELLED_AT).toISOString(), by, text: `Cancelled: ${c.cancelReason}` });
    c.history = history;
  });
}

function attachCampaignsToLeads(leads: Lead[], campaigns: Campaign[]): Lead[] {
  return leads.map((l) => ({ ...l, campaignId: rand() > 0.4 ? pick(campaigns).id : null }));
}

/**
 * Fills in what 3.0 quotes carry (owner, charge types, sent and decided dates, approval, history) without calling
 * rand(), so the rest of the seed stays the same. Discounts above 15% (the default limit) carry an approval.
 */
function finishQuotes(quotes: Quote[], products: Product[], accounts: Account[]): Quote[] {
  const active = OWNER_IDS.filter((id) => SEED_USERS.find((u) => u.id === id)?.active);
  return quotes.map((q, i) => {
    const owner = SEED_USERS.find((u) => u.id === active[i % active.length])!;
    const account = accounts.find((a) => a.id === q.accountId);
    const lineItems = q.lineItems.map((l) => {
      const p = products.find((x) => x.id === l.productId);
      return { ...l, sku: p?.sku, unit: p?.unit ?? 'One-time' };
    });
    const created = new Date(q.createdAt).getTime();
    const at = (ms: number) => new Date(Math.min(ms, now() - 60_000)).toISOString();
    const over = lineItems.some((l) => l.discountPct > 15);
    const history: Quote['history'] = [{ at: q.createdAt, by: owner.name, text: `Created by ${owner.name}` }];
    const out: Quote = { ...q, lineItems, ownerId: owner.id, approval: null, approvedBy: null, sentAt: null, decidedAt: null, rejectReason: null };
    if (q.status === 'Draft') {
      if (over && i % 2 === 0) {
        out.approval = 'waiting';
        history.push({ at: at(created + 3_600_000), by: owner.name, text: 'Approval asked' });
      }
    } else {
      if (over) {
        out.approval = 'approved';
        out.approvedBy = 'Alex Admin';
        history.push({ at: at(created + 3_600_000), by: owner.name, text: 'Approval asked' }, { at: at(created + 7_200_000), by: 'Alex Admin', text: 'Alex Admin approved the discounts' });
      }
      out.sentAt = at(created + DAY / 2);
      history.push({ at: out.sentAt, by: owner.name, text: `Sent to ${account?.name ?? 'the customer'} by ${owner.name}` });
      if (q.status === 'Expired') {
        out.validUntil = at(Math.min(created + 30 * DAY, now() - DAY));
        out.decidedAt = out.validUntil;
        history.push({ at: out.decidedAt, by: owner.name, text: 'Marked expired' });
      } else if (q.status === 'Accepted' || q.status === 'Rejected') {
        out.decidedAt = at(created + 6 * DAY);
        if (q.status === 'Rejected') out.rejectReason = QUOTE_REJECT_REASONS[i % 4];
        history.push({ at: out.decidedAt, by: owner.name, text: q.status === 'Accepted' ? 'Customer accepted' : `Rejected: ${out.rejectReason}` });
      }
    }
    out.history = history;
    return out;
  });
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
    { id: 'status-deal-lost-reason', module: 'deals', field: 'lostReason', name: 'Deal Lost Reason', options: [...DEAL_LOST_REASONS], isSystem: true },
    { id: 'status-activity-type', module: 'activities', field: 'type', name: 'Activity Type', options: [...ACTIVITY_TYPES], isSystem: true },
    { id: 'status-activity-outcome', module: 'activities', field: 'outcome', name: 'Call Outcome', options: [...CALL_OUTCOMES], isSystem: true },
    { id: 'status-ticket-channel', module: 'tickets', field: 'channel', name: 'Ticket Channel', options: [...TICKET_CHANNELS], isSystem: true },
    { id: 'status-ticket-category', module: 'tickets', field: 'category', name: 'Ticket Category', options: [...TICKET_CATEGORIES], isSystem: true },
    { id: 'status-ticket-canned', module: 'tickets', field: 'canned', name: 'Ticket Canned Replies', options: [...CANNED_REPLIES], isSystem: true },
    { id: 'status-product-family', module: 'products', field: 'category', name: 'Product Family', options: [...PRODUCT_CATEGORIES], isSystem: true },
    { id: 'status-quote-reject-reason', module: 'quotes', field: 'rejectReason', name: 'Quote Rejection Reason', options: [...QUOTE_REJECT_REASONS], isSystem: true },
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

// The standard promise per priority (server/src/sla.ts DEFAULT_POLICY): Urgent and High run round the clock,
// Medium and Low count working hours only.
function seedSlaConfigs(): SlaConfig[] {
  return [
    { id: 'sla-low', priority: 'Low', hours: 48, firstReplyHours: 8, clock: 'working' },
    { id: 'sla-medium', priority: 'Medium', hours: 24, firstReplyHours: 4, clock: 'working' },
    { id: 'sla-high', priority: 'High', hours: 8, firstReplyHours: 1, clock: '24x7' },
    { id: 'sla-urgent', priority: 'Urgent', hours: 4, firstReplyHours: 0.25, clock: '24x7' },
  ];
}

/**
 * Gives the seeded tickets owners, channels, categories, first replies and due times.
 * Uses no random numbers, so every other seeded record stays exactly as before.
 */
function enrichTickets(tickets: Ticket[], slaConfigs: SlaConfig[]): void {
  const team = ['user-1', 'user-2', 'user-4'];
  // Hours ago each open ticket was raised, so the queue shows a mix of fresh, nearly due and breached tickets.
  const ages = [1.2, 3.6, 0.4, 7, 2.2, 30, 0.7, 5.5];
  let open = 0;
  tickets.forEach((t, i) => {
    t.ownerId = i % 5 === 1 ? null : team[i % team.length];
    t.channel = TICKET_CHANNELS[i % TICKET_CHANNELS.length];
    t.category = TICKET_CATEGORIES[i % TICKET_CATEGORIES.length];
    t.contactId = null;
    t.accountId = null;
    t.layoutName = null;
    t.pausedAt = null;
    t.pausedMinutes = 0;
    t.escalation = 0;
    t.warnedAt = null;
    const isOpen = t.status === 'Open' || t.status === 'In Progress';
    if (isOpen) t.createdAt = new Date(now() - ages[open++ % ages.length] * 60 * 60_000).toISOString();
    const dues = duesFor(t, slaConfigs, DEFAULT_SLA_RULES);
    t.slaDue = dues.slaDue;
    t.firstReplyDue = dues.firstReplyDue;
    const replied = t.comments.length > 0 || t.status !== 'Open';
    t.firstReplyAt = replied ? new Date(Date.parse(t.createdAt) + 10 * 60_000).toISOString() : null;
    t.comments = t.comments.map((c) => ({ ...c, createdAt: t.firstReplyAt ?? c.createdAt, kind: 'reply' as const }));
    // Resolved in time, except every fourth closed ticket, which was late.
    t.resolvedAt = isOpen ? null : new Date(Date.parse(t.slaDue) + (i % 8 === 3 ? 3 : -2) * 60 * 60_000).toISOString();
  });
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
  deals: ['name', 'accountId', 'amount', 'stage', 'probability', 'closeDate', 'ownerId', 'campaignId', 'nextStep'],
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

export const ACTIVITY_TYPES = ['Call', 'Meeting', 'Visit', 'Email', 'Note'];
export const CALL_OUTCOMES = ['Connected', 'Left a voicemail', 'No answer', 'Asked to call back', 'Wrong number'];
const TEAM = ['user-1', 'user-2', 'user-4'];

/** Gives the seeded tasks an owner, a linked customer and, for some, a time of day. Uses the row number, not chance. */
function enrichTasks(tasks: TaskItem[], deals: Deal[], contacts: Contact[], accounts: Account[]): void {
  tasks.forEach((task, i) => {
    task.ownerId = TEAM[i % TEAM.length];
    task.dueTime = i % 4 === 1 ? '15:00' : i % 4 === 3 ? '10:30' : null;
    const kind = i % 3;
    const record = kind === 0 ? deals[i % deals.length] : kind === 1 ? contacts[i % contacts.length] : accounts[i % accounts.length];
    task.recordModule = kind === 0 ? 'deals' : kind === 1 ? 'contacts' : 'accounts';
    task.recordId = record?.id ?? null;
  });
}

/** This week's meetings, calls and visits, placed on the current Monday-to-Friday so the calendar never starts empty. */
function seedMeetings(deals: Deal[], contacts: Contact[], accounts: Account[]): Meeting[] {
  const monday = new Date();
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const at = (day: number, minutes: number) => new Date(monday.getTime() + day * DAY + minutes * 60 * 1000).toISOString();
  const plan: [string, string, number, number, number, 'deals' | 'contacts' | 'accounts' | null, number, string[], string][] = [
    ['Pipeline review', 'Meeting', 0, 570, 45, null, 0, TEAM, 'Board room 2'],
    ['Lunch with {c}', 'Meeting', 0, 780, 60, 'contacts', 3, ['user-2'], 'Café near the branch'],
    ['Credit committee', 'Meeting', 1, 600, 60, 'deals', 2, ['user-1', 'user-2'], 'Board room 1'],
    ['Call: {c}', 'Call', 1, 690, 30, 'contacts', 0, ['user-2'], 'Phone'],
    ['Site visit: {a}', 'Visit', 1, 900, 90, 'accounts', 4, ['user-2'], 'Customer office'],
    ['{d} review', 'Meeting', 2, 660, 60, 'deals', 6, ['user-2', 'user-4'], 'Video call'],
    ['Call: {c}', 'Call', 2, 840, 30, 'contacts', 5, ['user-2'], 'Phone'],
    ['Call: {c}', 'Call', 2, 855, 30, 'contacts', 7, ['user-4'], 'Phone'],
    ['Branch huddle', 'Meeting', 3, 540, 30, null, 0, TEAM, 'Floor 3'],
    ['Visit: {a}', 'Visit', 3, 720, 120, 'accounts', 9, ['user-1', 'user-2'], 'Customer site'],
    ['{d} demo', 'Meeting', 4, 960, 60, 'deals', 10, ['user-2'], 'Video call'],
    ['Portfolio review', 'Meeting', 4, 600, 60, null, 0, ['user-1'], 'Board room 2'],
  ];
  return plan.map(([title, type, day, start, dur, module, index, who, location], i) => {
    const deal = deals[index % deals.length], contact = contacts[index % contacts.length], account = accounts[index % accounts.length];
    const record = module === 'deals' ? deal : module === 'contacts' ? contact : module === 'accounts' ? account : null;
    return {
      id: `meeting-${i + 1}`,
      title: title.replace('{c}', contact?.name ?? 'customer').replace('{a}', account?.name ?? 'customer').replace('{d}', deal?.name ?? 'Deal'),
      type,
      start: at(day, start),
      durationMin: dur,
      ownerId: who[0],
      attendeeIds: who,
      contactIds: module === 'contacts' && contact ? [contact.id] : [],
      recordModule: record ? module : null,
      recordId: record?.id ?? null,
      location,
      reminder: '15 minutes before',
      notes: '',
      createdAt: new Date(monday.getTime() - 3 * DAY).toISOString(),
    };
  });
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
  finishCampaigns(campaigns, leadsWithCampaigns, deals);
  const quotes = finishQuotes(seedQuotes(accounts, deals, products), products, accounts);
  const customFieldDefs = seedCustomFieldDefs();
  const layouts = seedLayouts();
  const pageLayouts = seedPageLayouts();
  const roleDefs = seedRoleDefs();
  const assignmentRules = seedAssignmentRules();
  const dedupeRules = seedDedupeRules();
  const statusCodeSets = seedStatusCodeSets();
  const slaConfigs = seedSlaConfigs();
  enrichTickets(tickets, slaConfigs);
  const autoFlowProcesses = seedAutoFlowProcesses(products);
  applyCustomFieldExamples(leadsWithCampaigns, accounts);
  enrichTasks(tasks, deals, contacts, accounts);
  const meetings = seedMeetings(deals, contacts, accounts);

  return {
    users: [...SEED_USERS], // copy — SEED_USERS is a shared module-level constant, never hand out the live reference
    accounts,
    products,
    leads: leadsWithCampaigns,
    contacts,
    deals,
    tasks,
    meetings,
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
    slaRules: [] as SlaRules[],
    quoteSettings: [] as QuoteSettings[],
    dashboardLayouts: [] as DashboardLayout[],
    searchHistory: [] as SearchHistory[],
    setupDrafts: [],
    setupVersions: [],
    autoFlowProcesses,
    audit: [
      { id: 'audit-1', user: 'Alex Admin', action: 'seed', detail: 'Database seeded with sample data', when: new Date().toISOString() },
    ] as { id: string; user: string; action: string; detail: string; when: string }[],
  };
}
