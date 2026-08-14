import { Router } from 'express';
import { store, newId } from '../db.js';
import { crudRouter } from './crud.js';
import { dedupeRuleSchema } from '../schemas/dedupeRule.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { notFound } from '../errors.js';
import { DedupeRule } from '../types.js';

export const dedupeRulesRouter: Router = crudRouter<DedupeRule>({
  collection: store.dedupeRules,
  entityLabel: 'Dedupe rule',
  auditAction: 'dedupeRule',
  createSchema: dedupeRuleSchema,
  buildCreate: (body) => ({
    id: newId('deduperule'),
    module: body.module,
    name: body.name.trim(),
    active: body.active,
    matchFields: body.matchFields,
    matchType: body.matchType,
  }),
  buildUpdate: (body, id) => ({
    id,
    module: body.module,
    name: body.name.trim(),
    active: body.active,
    matchFields: body.matchFields,
    matchType: body.matchType,
  }),
});

dedupeRulesRouter.delete('/:id', requireAuth, requireRole('admin', 'rep'), (req, res) => {
  const rule = store.dedupeRules.get(req.params.id);
  if (!rule) throw notFound('Dedupe rule');
  store.dedupeRules.remove(rule.id);
  store.logAudit(req.user!.name, 'dedupeRule.delete', `Deleted dedupe rule "${rule.name}"`);
  res.status(204).end();
});
