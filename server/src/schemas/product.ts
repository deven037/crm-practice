import { z } from 'zod';

const customFieldsSchema = z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional();

export const productSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Name is required.'),
  sku: z.string().optional(),
  category: z.string().default('Subscription'),
  price: z.number().positive('Enter a valid price greater than 0.'),
  description: z.string().default(''),
  active: z.boolean().default(true),
  customFields: customFieldsSchema,
});
