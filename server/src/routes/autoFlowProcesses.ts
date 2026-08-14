import { Router } from 'express';
import { store, newId } from '../db.js';
import { crudRouter } from './crud.js';
import { autoFlowProcessSchema } from '../schemas/autoFlowProcess.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { conflict, notFound } from '../errors.js';
import { AutoFlowProcess } from '../types.js';

function buildProcess(body: any, existing?: AutoFlowProcess): AutoFlowProcess {
  return {
    id: existing?.id ?? newId('autoflow'),
    name: body.name.trim(),
    productId: existing?.productId ?? body.productId,
    allowedRoles: body.allowedRoles,
    targetModule: body.targetModule,
    status: body.status ?? 'draft',
    lanes: body.lanes.map((l: { id?: string; label: string; order: number }) => ({
      id: l.id ?? newId('autoflowlane'),
      label: l.label.trim(),
      order: l.order,
    })),
    milestones: body.milestones.map((m: { id?: string; label: string; order: number }) => ({
      id: m.id ?? newId('autoflowmilestone'),
      label: m.label.trim(),
      order: m.order,
    })),
    nodes: body.nodes.map((n: any) => ({ ...n, id: n.id ?? newId('autoflownode') })),
    edges: body.edges.map((e: any) => ({ ...e, id: e.id ?? newId('autoflowedge') })),
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// productId is immutable once an AutoFlow process exists — a process is meaningless
// detached from the product it was authored for, and this is a hard error (not a silent
// pin like PageLayout's isDefault-name lock) since accidentally reassigning the product
// on a process that already drives real record creation is a much bigger footgun.
export const autoFlowProcessesRouter: Router = crudRouter<AutoFlowProcess>({
  collection: store.autoFlowProcesses,
  entityLabel: 'AutoFlow process',
  auditAction: 'autoFlowProcess',
  createSchema: autoFlowProcessSchema,
  buildCreate: (body) => buildProcess(body),
  buildUpdate: (body, id) => {
    const existing = store.autoFlowProcesses.get(id);
    if (existing && body.productId !== existing.productId) {
      throw conflict('product_locked', 'The product cannot be changed after an AutoFlow process is created.');
    }
    return buildProcess(body, existing);
  },
});

autoFlowProcessesRouter.delete('/:id', requireAuth, requireRole('admin', 'rep'), (req, res) => {
  const process = store.autoFlowProcesses.get(req.params.id);
  if (!process) throw notFound('AutoFlow process');
  if (process.status === 'published') {
    throw conflict('published_process', 'A published AutoFlow process cannot be deleted — unpublish it first.');
  }
  store.autoFlowProcesses.remove(process.id);
  store.logAudit(req.user!.name, 'autoFlowProcess.delete', `Deleted AutoFlow process "${process.name}"`);
  res.status(204).end();
});
