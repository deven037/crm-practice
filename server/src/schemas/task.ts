import { z } from 'zod';
import { TASK_PRIORITIES } from '../types.js';

export const taskSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1, 'Title is required.'),
  dueDate: z.string(),
  priority: z.enum(TASK_PRIORITIES as [string, ...string[]]).default('Medium'),
  completed: z.boolean().default(false),
  order: z.number().default(0),
});
