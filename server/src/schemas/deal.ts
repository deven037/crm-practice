import { z } from 'zod';
import { DEAL_STAGES } from '../types.js';

const customFieldsSchema = z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional();

export const dealSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Name is required.'),
  accountId: z.string().nullable().optional(),
  amount: z.number().nonnegative().default(0),
  stage: z.enum(DEAL_STAGES as [string, ...string[]]).default('Qualification'),
  closeDate: z.string().optional(),
  probability: z.number().min(0).max(100).default(20),
  ownerId: z.string().min(1, 'Owner is required.'),
  campaignId: z.string().nullable().optional(),
  customFields: customFieldsSchema,
});
