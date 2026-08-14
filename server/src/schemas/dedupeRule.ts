import { z } from 'zod';

export const dedupeRuleSchema = z.object({
  id: z.string().optional(),
  module: z.enum(['leads', 'contacts']),
  name: z.string().min(1, 'Name is required.'),
  active: z.boolean().default(true),
  matchFields: z.array(z.string()).min(1, 'Select at least one field to match on.'),
  matchType: z.enum(['exact', 'fuzzy']).default('exact'),
});
