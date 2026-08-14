import { Router } from 'express';
import { store, newId } from '../db.js';
import { crudRouter } from './crud.js';
import { pageLayoutSchema } from '../schemas/pageLayout.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { conflict, notFound } from '../errors.js';
import { PageLayout } from '../types.js';

// The seeded "Default" layout per module is isDefault: true and cannot be renamed or
// deleted — every other named layout is a full custom PageLayout an admin can edit freely.
export const pageLayoutsRouter: Router = crudRouter<PageLayout>({
  collection: store.pageLayouts,
  entityLabel: 'Page layout',
  auditAction: 'pageLayout',
  createSchema: pageLayoutSchema,
  buildCreate: (body) => ({
    id: newId('pagelayout'),
    module: body.module,
    name: body.name.trim(),
    isDefault: false,
    tabs: body.tabs.map((t: { id?: string; label: string; fieldKeys: string[] }) => ({
      id: t.id ?? newId('layouttab'),
      label: t.label.trim(),
      fieldKeys: t.fieldKeys,
    })),
  }),
  buildUpdate: (body, id) => {
    const existing = store.pageLayouts.get(id);
    const isDefault = existing?.isDefault ?? false;
    return {
      id,
      module: existing?.module ?? body.module,
      name: isDefault ? existing!.name : body.name.trim(),
      isDefault,
      tabs: body.tabs.map((t: { id?: string; label: string; fieldKeys: string[] }) => ({
        id: t.id ?? newId('layouttab'),
        label: t.label.trim(),
        fieldKeys: t.fieldKeys,
      })),
    };
  },
});

pageLayoutsRouter.delete('/:id', requireAuth, requireRole('admin', 'rep'), (req, res) => {
  const layout = store.pageLayouts.get(req.params.id);
  if (!layout) throw notFound('Page layout');
  if (layout.isDefault) throw conflict('default_layout', 'The default layout cannot be deleted.');
  store.pageLayouts.remove(layout.id);
  store.logAudit(req.user!.name, 'pageLayout.delete', `Deleted page layout "${layout.name}" (${layout.module})`);
  res.status(204).end();
});
