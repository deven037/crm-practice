import { Router } from 'express';
import { store, newId } from '../db.js';
import { crudRouter } from './crud.js';
import { roleDefSchema } from '../schemas/roleDef.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { conflict, notFound } from '../errors.js';
import { RoleDef } from '../types.js';

// Informational directory only — never consulted by requireRole/Protected. Every row
// created through this API is isSystem: false; the 3 isSystem: true rows only ever come
// from the seed data and cannot be created or deleted here. Their name/description stay
// locked to the seed values, but — like any other role — their permissions checklist
// (pure reference metadata, read by nothing) can still be edited.
export const roleDefsRouter: Router = crudRouter<RoleDef>({
  collection: store.roleDefs,
  entityLabel: 'Role',
  auditAction: 'roleDef',
  createSchema: roleDefSchema,
  buildCreate: (body) => ({
    id: newId('role'),
    name: body.name.trim(),
    description: body.description ?? '',
    isSystem: false,
    permissions: body.permissions ?? [],
  }),
  buildUpdate: (body, id) => {
    const existing = store.roleDefs.get(id);
    const isSystem = existing?.isSystem ?? false;
    return {
      id,
      name: isSystem ? existing!.name : body.name.trim(),
      description: isSystem ? existing!.description : body.description ?? '',
      isSystem,
      permissions: body.permissions ?? [],
    };
  },
});

roleDefsRouter.delete('/:id', requireAuth, requireRole('admin', 'rep'), (req, res) => {
  const role = store.roleDefs.get(req.params.id);
  if (!role) throw notFound('Role');
  if (role.isSystem) throw conflict('system_role', 'System roles cannot be deleted.');
  store.roleDefs.remove(role.id);
  store.logAudit(req.user!.name, 'roleDef.delete', `Deleted role "${role.name}"`);
  res.status(204).end();
});
