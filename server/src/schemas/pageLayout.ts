import { z } from 'zod';
import { CUSTOM_FIELD_MODULES } from '../types.js';

const layoutTabSchema = z.object({
  id: z.string().optional(),
  label: z.string().min(1, 'Tab label is required.'),
  fieldKeys: z.array(z.string()).default([]),
});

export const pageLayoutSchema = z.object({
  id: z.string().optional(),
  module: z.enum(CUSTOM_FIELD_MODULES),
  name: z.string().min(1, 'Name is required.'),
  isDefault: z.boolean().default(false),
  tabs: z.array(layoutTabSchema).min(1, 'Add at least one tab.'),
});
