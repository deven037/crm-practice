import { Router } from 'express';
import { store } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { slaConfigSchema, slaPolicySchema } from '../schemas/slaConfig.js';
import { notFound } from '../errors.js';
import { SlaConfig, SlaRules, TICKET_PRIORITIES, TicketPriority } from '../types.js';
import { DEFAULT_POLICY, duesFor, isDone, rulesOf } from '../sla.js';

// One row per TicketPriority: hours to resolve, hours to first reply and which clock it runs on.
export const slaConfigsRouter: Router = Router();

/** Every priority's promise, filling gaps from the standard policy. */
function fullConfigs(): SlaConfig[] {
  const saved = store.slaConfigs.all();
  return [...TICKET_PRIORITIES].reverse().map((priority: TicketPriority) => {
    const c = saved.find((x) => x.priority === priority);
    const d = DEFAULT_POLICY[priority];
    return { id: c?.id ?? `sla-${priority.toLowerCase()}`, priority, hours: c?.hours ?? d.hours, firstReplyHours: c?.firstReplyHours ?? d.firstReplyHours, clock: c?.clock ?? d.clock };
  });
}

slaConfigsRouter.get('/policy', requireAuth, (_req, res) => {
  res.json({ configs: fullConfigs(), rules: rulesOf(store.slaRules.all()) });
});

slaConfigsRouter.put('/policy', requireAuth, requireRole('admin'), validateBody(slaPolicySchema), (req, res) => {
  const { configs, rules, apply } = req.body as { configs: Omit<SlaConfig, 'id'>[]; rules: Omit<SlaRules, 'id'>; apply: 'new' | 'all' };
  for (const c of configs) {
    const existing = store.slaConfigs.all().find((x) => x.priority === c.priority);
    const row: SlaConfig = { id: existing?.id ?? `sla-${c.priority.toLowerCase()}`, priority: c.priority, hours: c.hours, firstReplyHours: c.firstReplyHours, clock: c.clock };
    if (existing) store.slaConfigs.replace(existing.id, row);
    else store.slaConfigs.create(row);
  }
  const savedRules: SlaRules = { ...rules, id: 'sla-rules' };
  if (store.slaRules.get('sla-rules')) store.slaRules.replace('sla-rules', savedRules);
  else store.slaRules.create(savedRules);
  let moved = 0;
  if (apply === 'all') {
    const all = store.slaConfigs.all();
    for (const t of store.tickets.all().filter((x) => !isDone(x.status))) {
      const dues = duesFor(t, all, savedRules);
      // A ticket paused right now keeps the time already counted; the pause adds on when it ends.
      store.tickets.update(t.id, { slaDue: dues.slaDue, ...(t.firstReplyAt ? {} : { firstReplyDue: dues.firstReplyDue }), warnedAt: null });
      moved++;
    }
  }
  store.logAudit(req.user!.name, 'slaConfig.update', `Saved the SLA policy${apply === 'all' ? ` and recalculated ${moved} open tickets` : ''}`);
  res.json({ configs: fullConfigs(), rules: rulesOf(store.slaRules.all()), moved });
});

slaConfigsRouter.get('/', requireAuth, (req, res) => {
  res.json(store.slaConfigs.list(req.query as any));
});

slaConfigsRouter.get('/:id', requireAuth, (req, res) => {
  const item = store.slaConfigs.get(req.params.id);
  if (!item) throw notFound('SLA config');
  res.json(item);
});

slaConfigsRouter.put('/:id', requireAuth, requireRole('admin', 'rep'), validateBody(slaConfigSchema), (req, res) => {
  const existing = store.slaConfigs.get(req.params.id);
  if (!existing) throw notFound('SLA config');
  const updated = store.slaConfigs.replace(req.params.id, {
    ...existing,
    hours: req.body.hours,
    ...(req.body.firstReplyHours !== undefined ? { firstReplyHours: req.body.firstReplyHours } : {}),
    ...(req.body.clock ? { clock: req.body.clock } : {}),
  })!;
  store.logAudit(req.user!.name, 'slaConfig.update', `Set ${updated.priority} SLA to ${updated.hours}h`);
  res.json(updated);
});
