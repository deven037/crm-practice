import { z } from 'zod';

export const LINKED_MODULES = ['deals', 'contacts', 'accounts', 'leads'] as const;

/** An activity a person logs: a call, meeting, visit, email or note about one record. */
export const activitySchema = z.object({
  // One of the bank's activity types (Setup, status codes), so any short name is accepted.
  type: z.string().trim().min(1, 'Type is required.').max(40),
  recordModule: z.enum(LINKED_MODULES, { errorMap: () => ({ message: 'Pick who or what this was with.' }) }),
  recordId: z.string().min(1, 'Pick who or what this was with.'),
  when: z.string().datetime({ offset: true }).optional(),
  outcome: z.string().max(60).optional(),
  durationMin: z.number().int().min(0).max(1440).nullable().optional(),
  notes: z.string().max(2000).default(''),
});
