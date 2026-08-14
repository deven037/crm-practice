import { Router } from 'express';
import { store } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { slaConfigSchema } from '../schemas/slaConfig.js';
import { notFound } from '../errors.js';

// Fixed 4-row set (one per TicketPriority) — only hours are editable, no create/delete,
// so the SLA countdown always has a value for every priority.
export const slaConfigsRouter: Router = Router();

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
  const updated = store.slaConfigs.replace(req.params.id, { ...existing, hours: req.body.hours })!;
  store.logAudit(req.user!.name, 'slaConfig.update', `Set ${updated.priority} SLA to ${updated.hours}h`);
  res.json(updated);
});
