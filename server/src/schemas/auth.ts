import { z } from 'zod';

export const identifySchema = z.object({
  email: z.string().email('Enter a valid email address.'),
});

export const loginSchema = z.object({
  email: z.string().min(1, 'Email is required.'),
  password: z.string().min(1, 'Password is required.'),
  remember: z.boolean().optional(),
  // Which bank to sign in to. Not needed when the email's domain belongs to one bank.
  bankId: z.string().min(1).optional(),
  // For people whose email is not on their bank's domain: the bank's exact name.
  bankName: z.string().min(1).optional(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Enter a valid email address.'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters.'),
});
