import { z } from 'zod';

export const statusCodeSetSchema = z.object({
  id: z.string().optional(),
  module: z.enum(['leads', 'deals', 'campaigns']),
  field: z.string().min(1),
  name: z.string().min(1, 'Name is required.'),
  options: z.array(z.string().min(1)).min(1, 'Add at least one option.'),
  isSystem: z.boolean().default(false),
});
