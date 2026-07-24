import { Router } from 'express';
import { store, newId } from '../db.js';
import { crudRouter } from './crud.js';
import { dealSchema } from '../schemas/deal.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { notFound, conflict } from '../errors.js';
import { autoCloseDate } from '../utils.js';
import { Deal } from '../types.js';

function buildDeal(body: any): Deal {
  return {
    id: body.id ?? newId('deal'),
    name: body.name,
    accountId: body.accountId ?? null,
    amount: body.amount ?? 0,
    stage: body.stage ?? 'Qualification',
    closeDate: body.closeDate ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    probability: body.probability ?? 20,
    ownerId: body.ownerId,
    campaignId: body.campaignId ?? null,
    createdAt: new Date().toISOString(),
    customFields: body.customFields,
  };
}

export const dealsRouter: Router = crudRouter<Deal>({
  collection: store.deals,
  entityLabel: 'Deal',
  auditAction: 'deal',
  createSchema: dealSchema,
  buildCreate: (body) => buildDeal(body),
  buildUpdate: (body, id) => {
    const existing = store.deals.get(id);
    const built = { ...buildDeal(body), id, createdAt: existing?.createdAt ?? new Date().toISOString() };
    return existing ? autoCloseDate(existing.stage, built) : built;
  },
});

// DELETE /api/deals/:id — Closed Won deals require ?confirm=DELETE (or {confirm:'DELETE'} body),
// mirroring DealDetail.tsx's typed-DELETE UI gate.
dealsRouter.delete('/:id', requireAuth, requireRole('admin', 'rep'), (req, res) => {
  const deal = store.deals.get(req.params.id);
  if (!deal) throw notFound('Deal');
  const confirm = (req.query.confirm as string) ?? req.body?.confirm;
  if (deal.stage === 'Closed Won' && confirm !== 'DELETE') {
    throw conflict('confirmation_required', 'Deal is Closed Won; resend with confirm=DELETE.');
  }
  store.deals.remove(deal.id);
  store.logAudit(req.user!.name, 'deal.delete', `Deleted deal ${deal.name} (${deal.stage})`);
  res.status(204).end();
});
