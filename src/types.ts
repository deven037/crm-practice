export type Role = 'admin' | 'rep' | 'viewer';

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  /** Only ever sent when an admin chooses a first password; the API never returns it. */
  password?: string;
  role: Role;
  active: boolean;
  /** On a password an admin chose: must be replaced before anything else. */
  mustChangePassword?: boolean;
  /** Has an unused "set your password" link. */
  invitePending?: boolean;
}

export type LeadStatus = 'New' | 'Contacted' | 'Qualified' | 'Unqualified' | 'Converted';
export const LEAD_STATUSES: LeadStatus[] = ['New', 'Contacted', 'Qualified', 'Unqualified', 'Converted'];
export const LEAD_SOURCES = ['Web', 'Referral', 'Cold Call', 'Event', 'Partner'];

export interface Lead {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  status: LeadStatus;
  source: string;
  ownerId: string;
  value: number;
  productId?: string | null;
  campaignId?: string | null;
  createdAt: string;
  /** Which Page Layout this record was created with — set once at creation, never editable
   * afterward. Lets rule/AutoFlow conditions reference "Layout" against real record data instead
   * of a runtime-only signal, so they still evaluate correctly on later edits. */
  layoutName?: string | null;
  customFields?: Record<string, string | number | boolean | null>;
}

/** The standard product families; a bank edits its own list in Setup → Status codes ("Products — Family"). */
export const PRODUCT_CATEGORIES = ['Accounts', 'Cards', 'Payments', 'Lending', 'Trade', 'Wealth'];
/** The standard reasons a customer turns a quote down; a bank edits its own list in Setup → Status codes. */
export const QUOTE_REJECT_REASONS = ['Price too high', 'Chose another bank', 'No longer needed', 'Terms not acceptable', 'Approval took too long', 'Customer went silent', 'Other'];

/** How a price is charged. A quote's first-year value counts monthly prices 12 times. */
export type ChargeType = 'One-time' | 'Monthly' | 'Yearly';
export const CHARGE_TYPES: ChargeType[] = ['One-time', 'Monthly', 'Yearly'];

/** One price a product had from `at` on, and who set it. */
export interface PricePoint {
  price: number;
  at: string;
  by: string;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  /** The product family, one of the bank's "Product family" list. */
  category: string;
  price: number;
  description: string;
  active: boolean;
  createdAt: string;
  /** Missing on products made before 3.0: they count as one-time. */
  unit?: ChargeType;
  /** Every price the product has had, oldest first. The server adds a point when the price changes. */
  priceHistory?: PricePoint[];
  layoutName?: string | null;
  customFields?: Record<string, string | number | boolean | null>;
}

export interface ContactNote {
  id: string;
  text: string;
  createdAt: string;
}

export interface FileRef {
  id: string;
  name: string;
  size: number;
}

export interface Contact {
  id: string;
  name: string;
  email: string;
  phone: string;
  accountId: string | null;
  title: string;
  tags: string[];
  avatar: string | null;
  notes: ContactNote[];
  files: FileRef[];
  createdAt: string;
  layoutName?: string | null;
  customFields?: Record<string, string | number | boolean | null>;
}

export interface Account {
  id: string;
  name: string;
  industry: string;
  employees: number;
  revenue: number;
  website: string;
  phone: string;
  ownerId: string;
  createdAt: string;
  layoutName?: string | null;
  customFields?: Record<string, string | number | boolean | null>;
}

/** The built-in stages. A bank renames them or adds its own in Setup (status codes), so any stage name is allowed. */
export type DealStage = 'Qualification' | 'Proposal' | 'Negotiation' | 'Closed Won' | 'Closed Lost' | (string & {});
export const DEAL_STAGES: DealStage[] = ['Qualification', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost'];

export interface DealStageEvent {
  stage: string;
  at: string;
  by: string;
  /** The lost reason, when the deal entered a lost stage. */
  note?: string;
}

export interface Deal {
  id: string;
  name: string;
  accountId: string | null;
  amount: number;
  stage: DealStage;
  closeDate: string;
  probability: number;
  ownerId: string;
  campaignId?: string | null;
  /** Name of the page layout the deal was created with. */
  layoutName?: string | null;
  /** What happens next, and who does it. */
  nextStep?: string;
  /** Why the deal was lost; set only while it is in a lost stage. */
  lostReason?: string;
  /** Every stage the deal entered, oldest first. Written by the server, never by the browser. */
  stageHistory?: DealStageEvent[];
  createdAt: string;
  customFields?: Record<string, string | number | boolean | null>;
}

export type CampaignStatus = 'Planned' | 'Active' | 'Completed' | 'Cancelled';
export const CAMPAIGN_STATUSES: CampaignStatus[] = ['Planned', 'Active', 'Completed', 'Cancelled'];
export const CAMPAIGN_CHANNELS = [
  'Email',
  'Social Media',
  'Webinar',
  'Content Marketing',
  'Paid Search',
  'Trade Show',
  'Partner Referral',
];

export interface Campaign {
  id: string;
  name: string;
  channel: string;
  budget: number;
  startDate: string;
  endDate: string;
  status: CampaignStatus;
  createdAt: string;
  layoutName?: string | null;
  customFields?: Record<string, string | number | boolean | null>;
  ownerId?: string | null;
  /** Who the campaign is for, in the planner's words. */
  audience?: string;
  /** Leads the plan wants; with the budget it sets the planned cost per lead. */
  targetLeads?: number | null;
  /** Total of the spend log. Written by the server. */
  spent?: number;
  spendLog?: CampaignSpend[];
  cancelReason?: string | null;
  /** Written by the server, newest last. */
  history?: CampaignEvent[];
}

/** One payment logged against a campaign, such as an agency invoice. */
export interface CampaignSpend {
  amount: number;
  at: string;
  by: string;
  note?: string;
}

/** One line of a campaign's history, written by the server. */
export interface CampaignEvent {
  /** Set on a spend line, so the page can show it in the bank's currency. */
  amount?: number;
  at: string;
  by: string;
  text: string;
}

export type TaskPriority = 'Low' | 'Medium' | 'High';
export const TASK_PRIORITIES: TaskPriority[] = ['Low', 'Medium', 'High'];

/** The kinds of record a task, meeting or activity can be about. */
export type LinkedModule = 'deals' | 'contacts' | 'accounts' | 'leads';

export interface TaskItem {
  id: string;
  title: string;
  dueDate: string;
  priority: TaskPriority;
  completed: boolean;
  order: number;
  /** Who does it. Tasks saved before 3.0 have none and show for everyone. */
  ownerId?: string | null;
  /** "HH:MM" when the task is due at a set time of day. */
  dueTime?: string | null;
  recordModule?: LinkedModule | null;
  recordId?: string | null;
}

/** A meeting, call or visit on the calendar. */
export interface Meeting {
  id: string;
  title: string;
  /** One of the bank's activity types (Setup, status codes), for example Meeting, Call or Visit. */
  type: string;
  /** Start as an ISO date-time. */
  start: string;
  durationMin: number;
  ownerId: string;
  /** Colleagues taking part (user ids), the owner included. */
  attendeeIds: string[];
  /** Customers taking part (contact ids). */
  contactIds: string[];
  recordModule?: LinkedModule | null;
  recordId?: string | null;
  location: string;
  reminder: string;
  notes: string;
  createdAt: string;
}

export type TicketStatus = 'New' | 'Open' | 'In Progress' | 'Waiting on customer' | 'Resolved' | 'Closed';
export const TICKET_STATUSES: TicketStatus[] = ['New', 'Open', 'In Progress', 'Waiting on customer', 'Resolved', 'Closed'];
/** Statuses that end the SLA clock. */
export const TICKET_DONE: TicketStatus[] = ['Resolved', 'Closed'];
export type TicketPriority = 'Low' | 'Medium' | 'High' | 'Urgent';
export const TICKET_PRIORITIES: TicketPriority[] = ['Low', 'Medium', 'High', 'Urgent'];

/** Allowed status transitions for the ticket workflow. */
export const TICKET_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  New: ['Open', 'In Progress', 'Closed'],
  Open: ['In Progress', 'Waiting on customer', 'Resolved', 'Closed'],
  'In Progress': ['Waiting on customer', 'Resolved', 'Open'],
  'Waiting on customer': ['In Progress', 'Resolved', 'Closed'],
  Resolved: ['Closed', 'In Progress'],
  Closed: ['Open'],
};

/** reply: sent to the customer. note: only the team sees it. system: written by the CRM (status, priority, escalation). */
export type TicketCommentKind = 'reply' | 'note' | 'system';

export interface TicketComment {
  id: string;
  author: string;
  text: string;
  createdAt: string;
  /** Missing on comments written before 3.0; those count as replies. */
  kind?: TicketCommentKind;
  authorId?: string | null;
}

export interface Ticket {
  id: string;
  subject: string;
  description: string;
  requester: string;
  priority: TicketPriority;
  status: TicketStatus;
  /** When the ticket must be resolved. Written by the server from the SLA policy; moves on when a pause ends. */
  slaDue: string;
  createdAt: string;
  comments: TicketComment[];
  attachments: FileRef[];
  customFields?: Record<string, string | number | boolean | null>;
  // 3.0 fields, all optional so older tickets keep working.
  contactId?: string | null;
  accountId?: string | null;
  ownerId?: string | null;
  channel?: string;
  category?: string;
  layoutName?: string | null;
  /** When the first reply to the customer is due, and when it went out. */
  firstReplyDue?: string | null;
  firstReplyAt?: string | null;
  /** Set while the ticket sits in a status that pauses the SLA clock. */
  pausedAt?: string | null;
  /** Minutes the clock has been paused in total, before the current pause. */
  pausedMinutes?: number;
  resolvedAt?: string | null;
  /** 0 = not escalated, 1 to 3 = escalation level. */
  escalation?: number;
  /** When the "time is nearly used" warning went out, so it goes out once. */
  warnedAt?: string | null;
}

export type QuoteStatus = 'Draft' | 'Sent' | 'Accepted' | 'Rejected' | 'Expired';
export const QUOTE_STATUSES: QuoteStatus[] = ['Draft', 'Sent', 'Accepted', 'Rejected', 'Expired'];

/** Allowed status transitions for the quote workflow. */
export const QUOTE_TRANSITIONS: Record<QuoteStatus, QuoteStatus[]> = {
  Draft: ['Sent'],
  Sent: ['Accepted', 'Rejected', 'Expired'],
  Rejected: ['Draft'],
  Expired: ['Draft'],
  Accepted: [],
};

export interface QuoteLineItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  discountPct: number;
  /** Copied from the product when the line is added, so a quote never changes when the product does. */
  sku?: string;
  unit?: ChargeType;
}

/** null: no approval asked. Discounts above the bank's limit need 'approved' before the quote can be sent. */
export type QuoteApproval = 'waiting' | 'approved' | null;

/** One line of a quote's history, written by the server. */
export interface QuoteEvent {
  at: string;
  by: string;
  text: string;
}

export interface Quote {
  id: string;
  quoteNumber: string;
  accountId: string;
  dealId?: string | null;
  lineItems: QuoteLineItem[];
  status: QuoteStatus;
  validUntil: string;
  createdAt: string;
  customFields?: Record<string, string | number | boolean | null>;
  ownerId?: string | null;
  approval?: QuoteApproval;
  approvedBy?: string | null;
  sentAt?: string | null;
  decidedAt?: string | null;
  rejectReason?: string | null;
  history?: QuoteEvent[];
}

/** A bank's quote rules (Setup → Quote settings). One row; the defaults apply until an admin saves it. */
export interface QuoteSettings {
  id: string;
  taxName: string;
  taxPercent: number;
  validityDays: number;
  /** Discounts above this percentage need approval before the quote is sent. */
  discountLimit: number;
  /** Who approves; when empty, any admin can. */
  approverId: string | null;
}

export interface Activity {
  id: string;
  /** A sentence that reads on its own ("Priya Nair called Kavya Anand"), written when the activity is saved. */
  text: string;
  /** Older activities carry an emoji here instead of a type; new ones repeat the type. */
  icon: string;
  when: string;
  /** One of the bank's activity types, or "Deal update" / "Task done" for ones the CRM records itself. */
  type?: string;
  userId?: string;
  userName?: string;
  recordModule?: LinkedModule | null;
  recordId?: string | null;
  recordName?: string;
  outcome?: string;
  durationMin?: number | null;
  notes?: string;
  /** Recorded by the CRM itself (a stage change, a finished task), not logged by a person. */
  system?: boolean;
}

export interface AuditEntry {
  id: string;
  user: string;
  action: string;
  detail: string;
  when: string;
}

export interface AppNotification {
  id: string;
  text: string;
  read: boolean;
  when: string;
}

/** Modules that support admin-defined custom fields and designable layouts. */
export const CUSTOM_FIELD_MODULES = [
  'leads',
  'contacts',
  'accounts',
  'deals',
  'products',
  'tickets',
  'campaigns',
  'quotes',
] as const;
export type CustomFieldModule = (typeof CUSTOM_FIELD_MODULES)[number];

export type CustomFieldType = 'text' | 'number' | 'date' | 'dropdown' | 'checkbox';
export const CUSTOM_FIELD_TYPES: CustomFieldType[] = ['text', 'number', 'date', 'dropdown', 'checkbox'];

export interface CustomFieldDef {
  id: string;
  module: CustomFieldModule;
  key: string;
  label: string;
  type: CustomFieldType;
  options?: string[];
  required: boolean;
  createdAt: string;
}

export type LayoutTarget = 'form' | 'detail';

export interface LayoutDef {
  id: string;
  module: CustomFieldModule;
  target: LayoutTarget;
  fieldIds: string[];
}

export interface LayoutTab {
  id: string;
  label: string;
  /** System field keys (e.g. 'status') and/or CustomFieldDef ids, mixed freely in one tab. */
  fieldKeys: string[];
}

/**
 * A named, tabbed page layout for a module — the "Customise Page Layout" ToolBox feature.
 * Distinct from `LayoutDef` above (the single form/detail field-order list the existing
 * Custom Fields designer already writes and `CustomFieldsSection` already reads at
 * runtime) — this is a newer, richer, multi-layout/multi-tab config surface. Selectable
 * at record-creation time via the `?layout=` query param (see LayoutPickerPanel.tsx).
 */
export interface RecordCard {
  id: string;
  zone: 'main' | 'side';
}

export interface PageLayout {
  id: string;
  module: CustomFieldModule;
  name: string;
  isDefault: boolean;
  tabs: LayoutTab[];
  /** The cards on the record page and the column each sits in. Missing = the module's standard cards. */
  cards?: RecordCard[];
}

export type RoleOperation = 'view' | 'create' | 'edit' | 'delete';
export const ROLE_OPERATIONS: RoleOperation[] = ['view', 'create', 'edit', 'delete'];

export type AutoFlowNodeType = 'start' | 'end' | 'state' | 'wait' | 'decision' | 'gateway';

export interface AutoFlowCondition {
  /** System field key or CustomFieldDef id — same convention as AssignmentRule.conditions. */
  field: string;
  operator: 'equals' | 'contains';
  value: string;
}

export interface AutoFlowNodeData {
  label: string;
  /** 'state' nodes only — this step's visible fields (embedded, not a PageLayout reference). */
  fieldKeys?: string[];
  /** 'state' nodes only — calls into rules.ts rather than reimplementing dedupe/assignment. */
  action?: 'dedupe' | 'assign' | null;
  /** 'wait' nodes only — meaningful once a runtime engine (future work) exists. */
  waitMinutes?: number;
  /** 'decision' nodes only — single true/false branch. */
  condition?: AutoFlowCondition;
}

export interface AutoFlowNode {
  id: string;
  type: AutoFlowNodeType;
  position: { x: number; y: number };
  laneId: string;
  milestoneId: string;
  data: AutoFlowNodeData;
}

export interface AutoFlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  /** Gateway/decision branch label, e.g. "Call Later" / "Interested". */
  branchLabel?: string;
  /** Gateway edges — first matching edge wins; a condition-less edge is the "else" branch. */
  condition?: AutoFlowCondition;
}

export interface AutoFlowLane {
  id: string;
  label: string;
  order: number;
}

export interface AutoFlowMilestone {
  id: string;
  label: string;
  order: number;
}

/**
 * A visual, canvas-based process/flow layout tied to exactly one Product — "AutoFlow".
 * `productId` is immutable once created (enforced server-side). Once `published`, becomes
 * selectable as a record-creation path in `targetModule` via the `?autoflow=` query param,
 * sequencing multiple step-forms/branches instead of one flat form (see LeadForm.tsx).
 */
export interface AutoFlowProcess {
  id: string;
  name: string;
  productId: string;
  /** Access control — which roles may select this published process at record-creation time. */
  allowedRoles: Role[];
  targetModule: CustomFieldModule;
  status: 'draft' | 'published';
  lanes: AutoFlowLane[];
  milestones: AutoFlowMilestone[];
  nodes: AutoFlowNode[];
  edges: AutoFlowEdge[];
  createdAt: string;
  updatedAt: string;
}

export interface RolePermission {
  module: CustomFieldModule;
  operations: RoleOperation[];
}

/**
 * A named entry in the Roles directory (Setup → Roles) — purely informational metadata
 * about a role name/description, plus a per-module operations checklist the admin fills
 * in for reference (e.g. "Call Executive" → Leads: view). Distinct from `Role`, the
 * 3-value permission union that actually gates access via `requireRole`/`Protected
 * roles={[...]}` — creating or editing a RoleDef, including its `permissions`, never
 * grants any actual access; nothing here is read by any auth check. `isSystem` rows
 * mirror the 3 real permission tiers and cannot be deleted; custom rows are just labels
 * (with an optional permissions checklist) teams can use for their own reference.
 */
export interface RoleDef {
  id: string;
  name: string;
  description: string;
  isSystem: boolean;
  permissions?: RolePermission[];
}

// ---- Setup → ToolBox: 6 curated admin/config features ----

export type AssignmentRuleModule = 'leads' | 'contacts' | 'deals';
export type RuleOperator = 'equals' | 'contains';

export interface AssignmentRule {
  id: string;
  module: AssignmentRuleModule;
  name: string;
  active: boolean;
  conditions: { field: string; operator: RuleOperator; value: string }[];
  assignTo: string; // userId
  priority: number; // lower number = evaluated first; first active match wins
}

export type DedupeRuleModule = 'leads' | 'contacts';
export type DedupeMatchType = 'exact' | 'fuzzy';

export interface DedupeRule {
  id: string;
  module: DedupeRuleModule;
  name: string;
  active: boolean;
  matchFields: string[];
  matchType: DedupeMatchType;
}

/** Fields whose options are safe to reconfigure — never Ticket/Quote status, which have protected transition maps. */
export type StatusCodeModule = 'leads' | 'deals' | 'campaigns' | 'activities' | 'tickets' | 'products' | 'quotes';

export interface StatusCodeSet {
  id: string;
  module: StatusCodeModule;
  field: string; // e.g. 'status', 'stage', 'channel'
  name: string;
  options: string[];
  isSystem: boolean;
}

export type SlaClock = '24x7' | 'working';

/** One priority's promise. `hours` is the time to resolve (named before 3.0 added the first reply). */
export interface SlaConfig {
  id: string;
  priority: TicketPriority;
  hours: number;
  firstReplyHours?: number;
  clock?: SlaClock;
}

/** The bank's SLA rules: escalation, working hours and which statuses pause the clock. One record, id 'sla-rules'. */
export interface SlaRules {
  id: string;
  warnPercent: number;
  notifyOnWarn: boolean;
  escalateOnBreach: boolean;
  level1UserId: string | null;
  level2: boolean;
  level2AfterMinutes: number;
  level2UserId: string | null;
  autoAssign: boolean;
  autoAssignMinutes: number;
  pauseStatuses: TicketStatus[];
  /** 0 = Sunday. */
  workingDays: number[];
  workFrom: string;
  workTo: string;
  timeZone: string;
}

/** One card on a dashboard: how many of the 12 columns it spans and how many 34px rows it is tall (null: as tall as its content). */
export interface DashboardCard {
  id: string;
  span: number;
  rows: number | null;
  hidden: boolean;
}

/** A saved dashboard arrangement: one per person (id user-<userId>), plus the bank's default (id bank). */
export interface DashboardLayout {
  id: string;
  userId: string | null;
  cards: DashboardCard[];
  updatedAt: string;
}
