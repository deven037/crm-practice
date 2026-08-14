import { Router } from 'express';
import { store, newId } from '../db.js';
import { crudRouter } from './crud.js';
import { assignmentRuleSchema } from '../schemas/assignmentRule.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { notFound } from '../errors.js';
import { AssignmentRule } from '../types.js';

export const assignmentRulesRouter: Router = crudRouter<AssignmentRule>({
  collection: store.assignmentRules,
  entityLabel: 'Assignment rule',
  auditAction: 'assignmentRule',
  createSchema: assignmentRuleSchema,
  buildCreate: (body) => ({
    id: newId('assignrule'),
    module: body.module,
    name: body.name.trim(),
    active: body.active,
    conditions: body.conditions,
    assignTo: body.assignTo,
    priority: body.priority,
  }),
  buildUpdate: (body, id) => ({
    id,
    module: body.module,
    name: body.name.trim(),
    active: body.active,
    conditions: body.conditions,
    assignTo: body.assignTo,
    priority: body.priority,
  }),
});

assignmentRulesRouter.delete('/:id', requireAuth, requireRole('admin', 'rep'), (req, res) => {
  const rule = store.assignmentRules.get(req.params.id);
  if (!rule) throw notFound('Assignment rule');
  store.assignmentRules.remove(rule.id);
  store.logAudit(req.user!.name, 'assignmentRule.delete', `Deleted assignment rule "${rule.name}"`);
  res.status(204).end();
});
