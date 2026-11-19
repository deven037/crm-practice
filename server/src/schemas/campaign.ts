import { z } from 'zod';
import { CAMPAIGN_STATUSES } from '../types.js';

const customFieldsSchema = z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional();

export const campaignSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().min(1, 'Name is required.'),
    channel: z.string().default('Email'),
    budget: z.number().positive('Enter a valid budget greater than 0.'),
    startDate: z.string().min(1, 'Start date is required.'),
    endDate: z.string().min(1, 'End date is required.'),
    // Left out, the server sets it from the dates: Active when the run has started, otherwise Planned.
    status: z.enum(CAMPAIGN_STATUSES as [string, ...string[]]).optional(),
    layoutName: z.string().nullable().optional(),
    customFields: customFieldsSchema,
    ownerId: z.string().nullable().optional(),
    audience: z.string().max(1000).optional(),
    targetLeads: z.number().int().min(0).nullable().optional(),
  })
  .refine((data) => new Date(data.endDate).getTime() > new Date(data.startDate).getTime(), {
    message: 'End date must be after start date.',
    path: ['endDate'],
  });

export const campaignSpendSchema = z.object({
  amount: z.number().positive('Enter an amount greater than 0.').max(1e12),
  note: z.string().max(200).optional(),
});

export const campaignStatusSchema = z.object({
  status: z.enum(['Active', 'Completed', 'Cancelled']),
  reason: z.string().max(300).optional(),
});
