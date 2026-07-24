import { z } from 'zod';
import { QUOTE_STATUSES } from '../types.js';

const customFieldsSchema = z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional();

const lineItemSchema = z.object({
  id: z.string().optional(),
  productId: z.string().min(1),
  productName: z.string(),
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative(),
  discountPct: z.number().min(0).max(100).default(0),
});

export const quoteSchema = z.object({
  id: z.string().optional(),
  quoteNumber: z.string().optional(),
  accountId: z.string().min(1, 'Account is required.'),
  dealId: z.string().nullable().optional(),
  lineItems: z.array(lineItemSchema).min(1, 'At least one line item is required.'),
  status: z.enum(QUOTE_STATUSES as [string, ...string[]]).default('Draft'),
  validUntil: z.string().optional(),
  customFields: customFieldsSchema,
});

export const quoteTransitionSchema = z.object({
  status: z.enum(QUOTE_STATUSES as [string, ...string[]]),
});
