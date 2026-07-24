import { z } from 'zod';
import { CUSTOM_FIELD_MODULES, CUSTOM_FIELD_TYPES } from '../types.js';

export const customFieldSchema = z
  .object({
    id: z.string().optional(),
    module: z.enum(CUSTOM_FIELD_MODULES),
    key: z.string().optional(),
    label: z.string().min(1, 'Label is required.'),
    type: z.enum(CUSTOM_FIELD_TYPES as [string, ...string[]]),
    options: z.array(z.string()).optional(),
    required: z.boolean().default(false),
  })
  .refine((data) => data.type !== 'dropdown' || (data.options && data.options.length > 0), {
    message: 'Dropdown fields require at least one option.',
    path: ['options'],
  });
