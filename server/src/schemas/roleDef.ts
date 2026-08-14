import { z } from 'zod';

const rolePermissionSchema = z.object({
  module: z.enum(['leads', 'contacts', 'accounts', 'deals', 'products', 'tickets', 'campaigns', 'quotes']),
  operations: z.array(z.enum(['view', 'create', 'edit', 'delete'])),
});

export const roleDefSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Name is required.'),
  description: z.string().default(''),
  isSystem: z.boolean().default(false),
  permissions: z.array(rolePermissionSchema).default([]),
});
