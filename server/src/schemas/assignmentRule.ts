import { z } from 'zod';

export const assignmentRuleSchema = z.object({
  id: z.string().optional(),
  module: z.enum(['leads', 'contacts', 'deals']),
  name: z.string().min(1, 'Name is required.'),
  active: z.boolean().default(true),
  conditions: z
    .array(
      z.object({
        field: z.string().min(1),
        operator: z.enum(['equals', 'contains']),
        value: z.string(),
      })
    )
    .default([]),
  assignTo: z.string().min(1, 'Assign-to user is required.'),
  priority: z.number().int().default(0),
});
