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
    status: z.enum(CAMPAIGN_STATUSES as [string, ...string[]]).default('Planned'),
    customFields: customFieldsSchema,
  })
  .refine((data) => new Date(data.endDate).getTime() > new Date(data.startDate).getTime(), {
    message: 'End date must be after start date.',
    path: ['endDate'],
  });
