import { Request, Router } from 'express';
import { ZodSchema } from 'zod';
import { Collection, ListQuery } from '../db.js';
import { store } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { notFound } from '../errors.js';
import { Role } from '../types.js';

/**
 * Shared GET-list/GET-one/POST/PUT pattern for a resource. DELETE is intentionally
 * left to each resource's own route file, since delete business rules vary widely
 * (cascade-vs-unlink, confirmation gates, dependent-record cleanup).
 */
export function crudRouter<T extends { id: string }>(opts: {
  collection: Collection<T>;
  entityLabel: string; // e.g. "Lead" — used in 404 messages and audit details
  auditAction: string; // e.g. "lead" -> lead.create / lead.update
  createSchema: ZodSchema;
  updateSchema?: ZodSchema; // defaults to createSchema (full-replace semantics)
  buildCreate: (body: any, req: Request) => T;
  buildUpdate?: (body: any, id: string, req: Request) => T; // defaults to { ...body, id }
  mutateRoles?: Role[];
  describe?: (item: T) => string; // for audit detail strings; defaults to item.id
}) {
  const router = Router();
  const roles = opts.mutateRoles ?? (['admin', 'rep'] as Role[]);
  const describe = opts.describe ?? ((item: T) => (item as any).name ?? (item as any).id);

  router.get('/', requireAuth, (req, res) => {
    res.json(opts.collection.list(req.query as ListQuery));
  });

  router.get('/:id', requireAuth, (req, res) => {
    const item = opts.collection.get(req.params.id);
    if (!item) throw notFound(opts.entityLabel);
    res.json(item);
  });

  router.post('/', requireAuth, requireRole(...roles), validateBody(opts.createSchema), (req, res) => {
    const item = opts.buildCreate(req.body, req);
    opts.collection.create(item);
    store.logAudit(req.user!.name, `${opts.auditAction}.create`, `Created ${opts.entityLabel.toLowerCase()} ${describe(item)}`);
    res.status(201).json(item);
  });

  router.put(
    '/:id',
    requireAuth,
    requireRole(...roles),
    validateBody(opts.updateSchema ?? opts.createSchema),
    (req, res) => {
      const built = opts.buildUpdate
        ? opts.buildUpdate(req.body, req.params.id, req)
        : ({ ...req.body, id: req.params.id } as T);
      const updated = opts.collection.replace(req.params.id, built);
      if (!updated) throw notFound(opts.entityLabel);
      store.logAudit(req.user!.name, `${opts.auditAction}.update`, `Updated ${opts.entityLabel.toLowerCase()} ${describe(updated)}`);
      res.json(updated);
    }
  );

  return router;
}
