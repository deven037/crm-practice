import {
  Account,
  Activity,
  AppNotification,
  Contact,
  Deal,
  DEAL_STAGES,
  Lead,
  LEAD_SOURCES,
  LEAD_STATUSES,
  Product,
  TaskItem,
  Ticket,
  User,
} from '../types';

// Deterministic PRNG so every reset produces identical data — predictable assertions.
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

// [name, category, price]
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
    active: i % 7 !== 6, // a couple of inactive products for filtering practice
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
      status: LEAD_STATUSES[i % 4], // seed only non-Converted statuses
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
  const actions = [
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

export function buildSeedData() {
  rand = mulberry32(42);
  const accounts = seedAccounts();
  const products = seedProducts();
  return {
    users: SEED_USERS,
    accounts,
    products,
    leads: seedLeads(products),
    contacts: seedContacts(accounts),
    deals: seedDeals(accounts),
    tasks: seedTasks(),
    tickets: seedTickets(),
    activities: seedActivities(),
    notifications: seedNotifications(),
    audit: [
      { id: 'audit-1', user: 'Alex Admin', action: 'seed', detail: 'Database seeded with sample data', when: new Date().toISOString() },
    ],
  };
}
