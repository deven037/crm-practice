import { z } from 'zod';
import { LINKED_MODULES } from './activity.js';

export const meetingSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(1, 'Title is required.').max(160),
  type: z.string().trim().min(1).max(40).default('Meeting'),
  start: z.string().datetime({ offset: true, message: 'Pick a date and start time.' }),
  durationMin: z.number().int().min(5, 'A meeting lasts at least 5 minutes.').max(24 * 60),
  ownerId: z.string().optional(),
  attendeeIds: z.array(z.string()).max(50).default([]),
  contactIds: z.array(z.string()).max(50).default([]),
  recordModule: z.enum(LINKED_MODULES).nullable().optional(),
  recordId: z.string().nullable().optional(),
  location: z.string().max(300).default(''),
  reminder: z.string().max(40).default('15 minutes before'),
  notes: z.string().max(2000).default(''),
});
