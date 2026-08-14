import { z } from 'zod';

export const slaConfigSchema = z.object({
  id: z.string().optional(),
  priority: z.enum(['Low', 'Medium', 'High', 'Urgent']),
  hours: z.number().positive('Enter a valid number of hours.'),
});
