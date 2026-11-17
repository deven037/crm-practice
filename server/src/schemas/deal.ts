import { z } from 'zod';

const customFieldsSchema = z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional();

export const dealSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Name is required.'),
  accountId: z.string().nullable().optional(),
  amount: z.number().nonnegative().default(0),
  // A bank renames the built-in stages or adds its own (Setup, status codes), so any stage name is accepted.
  stage: z.string().trim().min(1, 'Stage is required.').max(60).default('Qualification'),
  closeDate: z.string().optional(),
  probability: z.number().min(0).max(100).default(20),
  ownerId: z.string().min(1, 'Owner is required.'),
  campaignId: z.string().nullable().optional(),
  layoutName: z.string().nullable().optional(),
  nextStep: z.string().max(500).optional(),
  lostReason: z.string().max(200).optional(),
  customFields: customFieldsSchema,
});
