import { z } from 'zod';
import { TASK_PRIORITIES } from '../types.js';
import { LINKED_MODULES } from './activity.js';

export const taskSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1, 'Title is required.'),
  dueDate: z.string(),
  priority: z.enum(TASK_PRIORITIES as [string, ...string[]]).default('Medium'),
  completed: z.boolean().default(false),
  order: z.number().default(0),
  ownerId: z.string().nullable().optional(),
  dueTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use a time like 15:00.').nullable().optional(),
  recordModule: z.enum(LINKED_MODULES).nullable().optional(),
  recordId: z.string().nullable().optional(),
});
