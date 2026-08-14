import { Router } from 'express';
import { store, newId } from '../db.js';
import { crudRouter } from './crud.js';
import { statusCodeSetSchema } from '../schemas/statusCodeSet.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { notFound } from '../errors.js';
import { StatusCodeSet } from '../types.js';

// isSystem rows reproduce today's hardcoded LEAD_STATUSES/DEAL_STAGES/CAMPAIGN_STATUSES/
// CAMPAIGN_CHANNELS lists — editable (that's the point of the feature) and deletable;
// deleting one just makes the relevant <Select> fall back to the hardcoded constant.
export const statusCodeSetsRouter: Router = crudRouter<StatusCodeSet>({
  collection: store.statusCodeSets,
  entityLabel: 'Status code set',
  auditAction: 'statusCodeSet',
  createSchema: statusCodeSetSchema,
  buildCreate: (body) => ({
    id: newId('statuscodes'),
    module: body.module,
    field: body.field,
    name: body.name.trim(),
    options: body.options,
    isSystem: false,
  }),
  buildUpdate: (body, id) => {
    const existing = store.statusCodeSets.get(id);
    return {
      id,
      module: body.module,
      field: body.field,
      name: body.name.trim(),
      options: body.options,
      isSystem: existing?.isSystem ?? false,
    };
  },
});

statusCodeSetsRouter.delete('/:id', requireAuth, requireRole('admin', 'rep'), (req, res) => {
  const set = store.statusCodeSets.get(req.params.id);
  if (!set) throw notFound('Status code set');
  store.statusCodeSets.remove(set.id);
  store.logAudit(req.user!.name, 'statusCodeSet.delete', `Deleted status code set "${set.name}"`);
  res.status(204).end();
});
