import { z } from 'zod';
import { CHARGE_TYPES, QUOTE_STATUSES } from '../types.js';

const customFieldsSchema = z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional();

const lineItemSchema = z.object({
  id: z.string().optional(),
  productId: z.string().min(1),
  productName: z.string(),
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative(),
  discountPct: z.number().min(0).max(100).default(0),
  sku: z.string().optional(),
  unit: z.enum(CHARGE_TYPES as [string, ...string[]]).optional(),
});

export const quoteSchema = z.object({
  id: z.string().optional(),
  quoteNumber: z.string().optional(),
  accountId: z.string().min(1, 'Account is required.'),
  dealId: z.string().nullable().optional(),
  lineItems: z.array(lineItemSchema).min(1, 'At least one line item is required.'),
  status: z.enum(QUOTE_STATUSES as [string, ...string[]]).default('Draft'),
  validUntil: z.string().optional(),
  ownerId: z.string().nullable().optional(),
  customFields: customFieldsSchema,
});

export const quoteTransitionSchema = z.object({
  status: z.enum(QUOTE_STATUSES as [string, ...string[]]),
  /** Why the customer said no; needed when the status is Rejected. */
  reason: z.string().trim().max(200).optional(),
  note: z.string().trim().max(500).optional(),
});

export const quoteApprovalSchema = z.object({
  decision: z.enum(['ask', 'approve', 'return']),
  note: z.string().trim().max(500).optional(),
});

export const quoteSettingsSchema = z.object({
  taxName: z.string().trim().min(1, 'Name the tax, for example GST.').max(20),
  taxPercent: z.number().min(0).max(100),
  validityDays: z.number().int().min(1).max(365),
  discountLimit: z.number().min(0).max(100),
  approverId: z.string().nullable(),
});
