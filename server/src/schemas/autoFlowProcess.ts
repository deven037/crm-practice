import { z } from 'zod';
import { CUSTOM_FIELD_MODULES } from '../types.js';

const conditionSchema = z.object({
  field: z.string().min(1),
  operator: z.enum(['equals', 'contains']),
  value: z.string(),
});

const nodeDataSchema = z.object({
  label: z.string().min(1, 'Node label is required.'),
  fieldKeys: z.array(z.string()).default([]),
  action: z.enum(['dedupe', 'assign']).nullable().default(null),
  waitMinutes: z.number().int().min(0).optional(),
  condition: conditionSchema.optional(),
});

const nodeSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['start', 'end', 'state', 'wait', 'decision', 'gateway']),
  position: z.object({ x: z.number(), y: z.number() }),
  laneId: z.string().min(1),
  milestoneId: z.string().min(1),
  data: nodeDataSchema,
});

const edgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  sourceHandle: z.string().nullable().optional(),
  targetHandle: z.string().nullable().optional(),
  branchLabel: z.string().optional(),
  condition: conditionSchema.optional(),
});

const laneSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1, 'Lane label is required.'),
  order: z.number().int(),
});

const milestoneSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1, 'Milestone label is required.'),
  order: z.number().int(),
});

export const autoFlowProcessSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Name is required.'),
  productId: z.string().min(1, 'Product is required.'),
  allowedRoles: z.array(z.enum(['admin', 'rep', 'viewer'])).min(1, 'Select at least one role.'),
  targetModule: z.enum(CUSTOM_FIELD_MODULES),
  status: z.enum(['draft', 'published']).default('draft'),
  lanes: z.array(laneSchema).default([]),
  milestones: z.array(milestoneSchema).default([]),
  nodes: z.array(nodeSchema).default([]),
  edges: z.array(edgeSchema).default([]),
});
