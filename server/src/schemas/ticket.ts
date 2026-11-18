import { z } from 'zod';
import { TICKET_PRIORITIES, TICKET_STATUSES } from '../types.js';

const customFieldsSchema = z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional();
const statusEnum = z.enum(TICKET_STATUSES as [string, ...string[]]);

export const ticketSchema = z.object({
  id: z.string().optional(),
  subject: z.string().trim().min(1, 'Subject is required.').max(200, 'Keep the subject under 200 characters.'),
  description: z.string().max(10000).default(''),
  requester: z.string().trim().min(1, 'Requester is required.'),
  priority: z.enum(TICKET_PRIORITIES as [string, ...string[]]).default('Medium'),
  status: statusEnum.default('Open'),
  // Due times are worked out by the server; a value sent here is ignored.
  slaDue: z.string().optional(),
  comments: z
    .array(
      z.object({
        id: z.string(),
        author: z.string(),
        text: z.string(),
        createdAt: z.string(),
        kind: z.enum(['reply', 'note', 'system']).optional(),
        authorId: z.string().nullable().optional(),
      })
    )
    .optional(),
  attachments: z.array(z.object({ id: z.string(), name: z.string(), size: z.number() })).default([]),
  customFields: customFieldsSchema,
  contactId: z.string().nullable().optional(),
  accountId: z.string().nullable().optional(),
  ownerId: z.string().nullable().optional(),
  channel: z.string().max(60).optional(),
  category: z.string().max(60).optional(),
  layoutName: z.string().nullable().optional(),
});

export const ticketTransitionSchema = z.object({
  status: statusEnum,
  /** A resolution note: sent to the customer as a reply before the status changes. */
  note: z.string().trim().max(5000).optional(),
});

export const ticketCommentSchema = z.object({
  text: z.string().trim().min(1, 'Comment text is required.').max(5000),
  kind: z.enum(['reply', 'note']).default('reply'),
  /** Move the ticket to this status after the reply (for example Waiting on customer). */
  thenStatus: statusEnum.optional(),
});

export const ticketAssignSchema = z.object({ ownerId: z.string().nullable() });

export const ticketEscalateSchema = z.object({
  level: z.number().int().min(1).max(3),
  reason: z.string().trim().min(1, 'Say why it needs to go up.').max(1000),
});
