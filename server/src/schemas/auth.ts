import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().min(1, 'Email is required.'),
  password: z.string().min(1, 'Password is required.'),
  remember: z.boolean().optional(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Enter a valid email address.'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters.'),
});
