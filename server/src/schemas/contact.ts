import { z } from 'zod';

const customFieldsSchema = z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional();

export const contactSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Name is required.'),
  email: z.string().email('Enter a valid email.'),
  phone: z.string().default(''),
  accountId: z.string().nullable().optional(),
  title: z.string().default(''),
  tags: z.array(z.string()).default([]),
  avatar: z.string().nullable().optional(),
  notes: z
    .array(z.object({ id: z.string(), text: z.string(), createdAt: z.string() }))
    .default([]),
  files: z.array(z.object({ id: z.string(), name: z.string(), size: z.number() })).default([]),
  customFields: customFieldsSchema,
});
