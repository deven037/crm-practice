import { z } from 'zod';

const customFieldsSchema = z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional();

export const accountSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Name is required.'),
  industry: z.string().default(''),
  employees: z.number().nonnegative().default(0),
  revenue: z.number().nonnegative().default(0),
  website: z.string().default(''),
  phone: z.string().default(''),
  ownerId: z.string().min(1, 'Owner is required.'),
  customFields: customFieldsSchema,
});
