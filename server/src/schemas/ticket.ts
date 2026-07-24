import { z } from 'zod';
import { TICKET_PRIORITIES } from '../types.js';

const customFieldsSchema = z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional();

export const ticketSchema = z.object({
  id: z.string().optional(),
  subject: z.string().min(1, 'Subject is required.'),
  description: z.string().default(''),
  requester: z.string().min(1, 'Requester is required.'),
  priority: z.enum(TICKET_PRIORITIES as [string, ...string[]]).default('Medium'),
  status: z.enum(['Open', 'In Progress', 'Resolved', 'Closed']).default('Open'),
  slaDue: z.string().optional(),
  comments: z
    .array(z.object({ id: z.string(), author: z.string(), text: z.string(), createdAt: z.string() }))
    .default([]),
  attachments: z.array(z.object({ id: z.string(), name: z.string(), size: z.number() })).default([]),
  customFields: customFieldsSchema,
});

export const ticketTransitionSchema = z.object({
  status: z.enum(['Open', 'In Progress', 'Resolved', 'Closed']),
});

export const ticketCommentSchema = z.object({
  text: z.string().min(1, 'Comment text is required.'),
});
