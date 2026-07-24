import { Router } from 'express';
import { store, newId } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { customFieldSchema } from '../schemas/customField.js';
import { notFound } from '../errors.js';
import { slugify } from '../utils.js';
import { CustomFieldDef, CustomFieldModule } from '../types.js';

export const customFieldDefsRouter = Router();

function moduleCollection(module: CustomFieldModule) {
  return (store as any)[module] as { all: () => { id: string; customFields?: Record<string, unknown> }[]; update: (id: string, patch: any) => unknown };
}

customFieldDefsRouter.get('/', requireAuth, (req, res) => {
  res.json(store.customFieldDefs.list(req.query as any));
});

customFieldDefsRouter.get('/:id', requireAuth, (req, res) => {
  const def = store.customFieldDefs.get(req.params.id);
  if (!def) throw notFound('Custom field');
  res.json(def);
});

customFieldDefsRouter.post(
  '/',
  requireAuth,
  requireRole('admin', 'rep'),
  validateBody(customFieldSchema),
  (req, res) => {
    const body = req.body as { module: CustomFieldModule; label: string; type: CustomFieldDef['type']; options?: string[]; required: boolean };
    const def: CustomFieldDef = {
      id: newId('customfield'),
      module: body.module,
      key: slugify(body.label),
      label: body.label.trim(),
      type: body.type,
      options: body.options,
      required: body.required,
      createdAt: new Date().toISOString(),
    };
    store.customFieldDefs.create(def);
    store.logAudit(req.user!.name, 'customfield.create', `Created custom field "${def.label}" on ${def.module}`);
    res.status(201).json(def);
  }
);

customFieldDefsRouter.put(
  '/:id',
  requireAuth,
  requireRole('admin', 'rep'),
  validateBody(customFieldSchema),
  (req, res) => {
    const existing = store.customFieldDefs.get(req.params.id);
    if (!existing) throw notFound('Custom field');
    const body = req.body as { module: CustomFieldModule; label: string; type: CustomFieldDef['type']; options?: string[]; required: boolean };
    const updated = store.customFieldDefs.replace(req.params.id, {
      ...existing,
      label: body.label.trim(),
      type: body.type,
      options: body.options,
      required: body.required,
    })!;
    store.logAudit(req.user!.name, 'customfield.create', `Updated custom field "${updated.label}" on ${updated.module}`);
    res.json(updated);
  }
);

// DELETE unlinks the field's value from every record of its module and strips its id
// out of any LayoutDef.fieldIds that reference it.
customFieldDefsRouter.delete('/:id', requireAuth, requireRole('admin', 'rep'), (req, res) => {
  const def = store.customFieldDefs.get(req.params.id);
  if (!def) throw notFound('Custom field');

  const collection = moduleCollection(def.module);
  const affected = collection.all().filter((r) => r.customFields && def.key in r.customFields);
  affected.forEach((r) => {
    const rest = { ...r.customFields };
    delete rest[def.key];
    collection.update(r.id, { customFields: rest });
  });

  store.layouts.all().forEach((l) => {
    if (l.fieldIds.includes(def.id)) {
      store.layouts.update(l.id, { fieldIds: l.fieldIds.filter((id) => id !== def.id) });
    }
  });

  store.customFieldDefs.remove(def.id);
  store.logAudit(
    req.user!.name,
    'customfield.delete',
    `Deleted custom field "${def.label}" from ${def.module} (${affected.length} record(s) had a value)`
  );
  res.status(204).end();
});
