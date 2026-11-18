import { z } from 'zod';
import { CHARGE_TYPES } from '../types.js';

const customFieldsSchema = z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional();

export const productSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Name is required.'),
  sku: z.string().optional(),
  category: z.string().default('Accounts'),
  price: z.number().positive('Enter a valid price greater than 0.'),
  unit: z.enum(CHARGE_TYPES as [string, ...string[]]).optional(),
  description: z.string().default(''),
  active: z.boolean().default(true),
  layoutName: z.string().nullable().optional(),
  customFields: customFieldsSchema,
});
