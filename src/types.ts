export type Role = 'admin' | 'rep' | 'viewer';

export interface User {
  id: string;
  name: string;
  email: string;
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
  createdAt: string;
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
  createdAt: string;
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
