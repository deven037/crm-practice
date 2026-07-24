import { z } from 'zod';
import { CUSTOM_FIELD_MODULES } from '../types.js';

export const layoutSchema = z.object({
  id: z.string().optional(),
  module: z.enum(CUSTOM_FIELD_MODULES),
  target: z.enum(['form', 'detail']),
  fieldIds: z.array(z.string()).default([]),
});
