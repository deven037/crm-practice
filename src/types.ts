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
