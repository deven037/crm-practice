import { z } from 'zod';
import { DEAL_STAGES, LEAD_STATUSES } from '../types.js';

const customFieldsSchema = z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional();

export const leadSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Name is required.'),
  company: z.string().default(''),
  email: z.string().email('Enter a valid email.'),
  phone: z.string().default(''),
  status: z.enum(LEAD_STATUSES as [string, ...string[]]).default('New'),
  source: z.string().default('Web'),
  ownerId: z.string().min(1, 'Owner is required.'),
  value: z.number().nonnegative().default(0),
  productId: z.string().nullable().optional(),
  campaignId: z.string().nullable().optional(),
  customFields: customFieldsSchema,
});

export const leadConvertSchema = z.object({
  accountMode: z.enum(['new', 'existing']),
  existingAccountId: z.string().optional(),
  accountName: z.string().optional(),
  contactName: z.string().min(1, 'Contact name is required.'),
  contactEmail: z.string().email('Enter a valid contact email.'),
  contactPhone: z.string().optional().default(''),
  createDeal: z.boolean().optional().default(false),
  dealName: z.string().optional(),
  dealAmount: z.number().optional(),
  dealStage: z.enum(DEAL_STAGES as [string, ...string[]]).optional(),
});
