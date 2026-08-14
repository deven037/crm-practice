// Mirrored copy of ../../src/types.ts — keep in sync manually when the client's
// domain types change. Duplicated (not shared via a package) to keep this a
// standalone, independently deployable service.

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
  fieldKeys: string[];
}

/** "Customise Page Layout" ToolBox feature — see client src/types.ts for full rationale. */
export interface PageLayout {
  id: string;
  module: CustomFieldModule;
  name: string;
  isDefault: boolean;
  tabs: LayoutTab[];
}

export type RoleOperation = 'view' | 'create' | 'edit' | 'delete';

export type AutoFlowNodeType = 'start' | 'end' | 'state' | 'wait' | 'decision' | 'gateway';

export interface AutoFlowCondition {
  field: string;
  operator: 'equals' | 'contains';
  value: string;
}

export interface AutoFlowNodeData {
  label: string;
  fieldKeys?: string[];
  action?: 'dedupe' | 'assign' | null;
  waitMinutes?: number;
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
  branchLabel?: string;
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

/** "AutoFlow" process/flow designer, tied to exactly one Product — see client src/types.ts for full rationale. */
export interface AutoFlowProcess {
  id: string;
  name: string;
  productId: string;
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

/** Informational Roles-directory entry — distinct from `Role`, the 3-value permission union. See client src/types.ts for full rationale. */
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
  assignTo: string;
  priority: number;
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

export type StatusCodeModule = 'leads' | 'deals' | 'campaigns';

export interface StatusCodeSet {
  id: string;
  module: StatusCodeModule;
  field: string;
  name: string;
  options: string[];
  isSystem: boolean;
}

export interface SlaConfig {
  id: string;
  priority: TicketPriority;
  hours: number;
}
