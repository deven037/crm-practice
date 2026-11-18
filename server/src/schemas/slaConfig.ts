import { z } from 'zod';
import { TICKET_STATUSES } from '../types.js';

const priority = z.enum(['Low', 'Medium', 'High', 'Urgent']);
const hours = z.number().positive('Enter a valid number of hours.').max(24 * 30, 'Keep it under 30 days.');

export const slaConfigSchema = z.object({
  id: z.string().optional(),
  priority,
  hours,
  firstReplyHours: hours.optional(),
  clock: z.enum(['24x7', 'working']).optional(),
});

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use a time like 09:00.');

export const slaPolicySchema = z
  .object({
    configs: z.array(z.object({ priority, hours, firstReplyHours: hours, clock: z.enum(['24x7', 'working']) })).min(1),
    rules: z.object({
      warnPercent: z.number().int().min(10).max(99),
      notifyOnWarn: z.boolean(),
      escalateOnBreach: z.boolean(),
      level1UserId: z.string().nullable(),
      level2: z.boolean(),
      level2AfterMinutes: z.number().int().min(0).max(7 * 24 * 60),
      level2UserId: z.string().nullable(),
      autoAssign: z.boolean(),
      autoAssignMinutes: z.number().int().min(1).max(7 * 24 * 60),
      pauseStatuses: z.array(z.enum(TICKET_STATUSES as [string, ...string[]])),
      workingDays: z.array(z.number().int().min(0).max(6)),
      workFrom: time,
      workTo: time,
      timeZone: z.string().min(1).max(64),
    }),
    /** new: open tickets keep their due times. all: open tickets are recalculated. */
    apply: z.enum(['new', 'all']).default('new'),
  })
  .superRefine((value, ctx) => {
    value.configs.forEach((c, i) => {
      if (c.firstReplyHours >= c.hours) ctx.addIssue({ code: 'custom', path: ['configs', i, 'firstReplyHours'], message: `${c.priority}: the first reply must come before the resolve time.` });
    });
    if (value.rules.workTo <= value.rules.workFrom) ctx.addIssue({ code: 'custom', path: ['rules', 'workTo'], message: 'Working hours must end after they start.' });
  });
