export type Role = 'admin' | 'rep' | 'viewer';

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  password: string;
  role: Role;
  active: boolean;
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
  customFields?: Record<string, string | number | boolean | null>;
}

export const PRODUCT_CATEGORIES = ['Subscription', 'Service', 'Add-on', 'License', 'Training'];

export interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  price: number;
  description: string;
  active: boolean;
  createdAt: string;
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
  customFields?: Record<string, string | number | boolean | null>;
}

export type DealStage = 'Qualification' | 'Proposal' | 'Negotiation' | 'Closed Won' | 'Closed Lost';
export const DEAL_STAGES: DealStage[] = ['Qualification', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost'];

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
  customFields?: Record<string, string | number | boolean | null>;
}

export type TaskPriority = 'Low' | 'Medium' | 'High';
export const TASK_PRIORITIES: TaskPriority[] = ['Low', 'Medium', 'High'];

export interface TaskItem {
  id: string;
  title: string;
  dueDate: string;
  priority: TaskPriority;
  completed: boolean;
  order: number;
}

export type TicketStatus = 'Open' | 'In Progress' | 'Resolved' | 'Closed';
export type TicketPriority = 'Low' | 'Medium' | 'High' | 'Urgent';
export const TICKET_PRIORITIES: TicketPriority[] = ['Low', 'Medium', 'High', 'Urgent'];

/** Allowed status transitions for the ticket workflow. */
export const TICKET_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  Open: ['In Progress', 'Closed'],
  'In Progress': ['Resolved', 'Open'],
  Resolved: ['Closed', 'In Progress'],
  Closed: ['Open'],
};

export interface TicketComment {
  id: string;
  author: string;
  text: string;
  createdAt: string;
}

export interface Ticket {
  id: string;
  subject: string;
  description: string;
  requester: string;
  priority: TicketPriority;
  status: TicketStatus;
  slaDue: string;
  createdAt: string;
  comments: TicketComment[];
  attachments: FileRef[];
  customFields?: Record<string, string | number | boolean | null>;
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
}

export interface Activity {
  id: string;
  text: string;
  icon: string;
  when: string;
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
export interface PageLayout {
  id: string;
  module: CustomFieldModule;
  name: string;
  isDefault: boolean;
  tabs: LayoutTab[];
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
export type StatusCodeModule = 'leads' | 'deals' | 'campaigns';

export interface StatusCodeSet {
  id: string;
  module: StatusCodeModule;
  field: string; // e.g. 'status', 'stage', 'channel'
  name: string;
  options: string[];
  isSystem: boolean;
}

export interface SlaConfig {
  id: string;
  priority: TicketPriority;
  hours: number;
}
