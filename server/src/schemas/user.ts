import { z } from 'zod';

export const userCreateSchema = z.object({
  name: z.string().min(1, 'Name is required.'),
  email: z.string().email('Enter a valid email address.'),
  phone: z.string().optional(),
  password: z.string().optional(),
  role: z.enum(['admin', 'rep', 'viewer']).default('rep'),
  active: z.boolean().default(true),
});

export const userUpdateSchema = z.object({
  name: z.string().min(1, 'Name is required.'),
  email: z.string().email('Enter a valid email address.'),
  phone: z.string().optional(),
  role: z.enum(['admin', 'rep', 'viewer']).optional(),
  active: z.boolean().optional(),
});
