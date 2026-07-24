import { Router } from 'express';
import { store, newId } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { layoutSchema } from '../schemas/layout.js';
import { notFound } from '../errors.js';
import { ApiError } from '../errors.js';
import { LayoutDef } from '../types.js';

export const layoutsRouter = Router();

function validateFieldIds(module: LayoutDef['module'], fieldIds: string[]) {
  const validIds = new Set(store.customFieldDefs.all().filter((d) => d.module === module).map((d) => d.id));
  const invalid = fieldIds.filter((id) => !validIds.has(id));
  if (invalid.length > 0) {
    throw new ApiError(422, 'invalid_field_ids', 'One or more field ids do not belong to this module.', { invalid });
  }
}

layoutsRouter.get('/', requireAuth, (req, res) => {
  res.json(store.layouts.list(req.query as any));
});

layoutsRouter.get('/:id', requireAuth, (req, res) => {
  const layout = store.layouts.get(req.params.id);
  if (!layout) throw notFound('Layout');
  res.json(layout);
});

layoutsRouter.post('/', requireAuth, requireRole('admin', 'rep'), validateBody(layoutSchema), (req, res) => {
  const body = req.body as { module: LayoutDef['module']; target: LayoutDef['target']; fieldIds: string[] };
  validateFieldIds(body.module, body.fieldIds);
  // Upsert-by-(module,target): a layout already exists for most module+target pairs
  // (created at seed time or by a prior save), so replace it rather than duplicate.
  const existing = store.layouts.all().find((l) => l.module === body.module && l.target === body.target);
  const layout: LayoutDef = existing
    ? { ...existing, fieldIds: body.fieldIds }
    : { id: newId('layout'), module: body.module, target: body.target, fieldIds: body.fieldIds };
  if (existing) store.layouts.replace(existing.id, layout);
  else store.layouts.create(layout);
  store.logAudit(req.user!.name, 'layout.save', `Layout saved for ${body.module} (${body.target})`);
  res.status(existing ? 200 : 201).json(layout);
});

layoutsRouter.put('/:id', requireAuth, requireRole('admin', 'rep'), validateBody(layoutSchema), (req, res) => {
  const existing = store.layouts.get(req.params.id);
  if (!existing) throw notFound('Layout');
  const body = req.body as { module: LayoutDef['module']; target: LayoutDef['target']; fieldIds: string[] };
  validateFieldIds(body.module, body.fieldIds);
  const updated = store.layouts.replace(req.params.id, { ...body, id: req.params.id })!;
  store.logAudit(req.user!.name, 'layout.save', `Layout saved for ${body.module} (${body.target})`);
  res.json(updated);
});
