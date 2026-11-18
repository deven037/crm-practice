import { Request, Router } from 'express';
import { store, newId } from '../db.js';
import { crudRouter } from './crud.js';
import { dealSchema } from '../schemas/deal.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { notFound, conflict } from '../errors.js';
import { autoCloseDate } from '../utils.js';
import { Deal, DealStageEvent } from '../types.js';
import { recordSystemActivity } from './activities.js';

/** Enough history for any real deal while keeping each row small (storage rule: no growing logs on records). */
export const STAGE_HISTORY_LIMIT = 50;

const isLostStage = (stage: string) => /^closed\b/i.test(stage) && !/\bwon\b/i.test(stage);

function buildDeal(body: any): Deal {
  const stage = body.stage ?? 'Qualification';
  return {
    id: body.id ?? newId('deal'),
    name: body.name,
    accountId: body.accountId ?? null,
    amount: body.amount ?? 0,
    stage,
    closeDate: body.closeDate ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    probability: body.probability ?? 20,
    ownerId: body.ownerId,
    campaignId: body.campaignId ?? null,
    layoutName: body.layoutName ?? null,
    nextStep: body.nextStep ?? '',
    // A lost reason only belongs to a lost deal: reopening clears it.
    lostReason: isLostStage(stage) ? body.lostReason ?? '' : '',
    createdAt: new Date().toISOString(),
    customFields: body.customFields,
  };
}

/**
 * The stage history is kept by the server: one entry when the deal is created and one each time its stage
 * changes, stamped with who did it. Anything the browser sends as history is ignored.
 */
export function withStageHistory(deal: Deal, existing: Deal | undefined, req: Request): Deal {
  // A deal saved before history existed starts from the stage it had then (who set it is not known).
  const past = existing ? existing.stageHistory ?? [{ stage: existing.stage, at: existing.createdAt, by: '' }] : [];
  if (existing && existing.stage === deal.stage) return { ...deal, stageHistory: past };
  const event: DealStageEvent = { stage: deal.stage, at: new Date().toISOString(), by: req.user?.name ?? 'Someone' };
  if (isLostStage(deal.stage) && deal.lostReason) event.note = deal.lostReason;
  return { ...deal, stageHistory: [...past, event].slice(-STAGE_HISTORY_LIMIT) };
}

export const dealsRouter: Router = crudRouter<Deal>({
  collection: store.deals,
  entityLabel: 'Deal',
  auditAction: 'deal',
  createSchema: dealSchema,
  buildCreate: (body, req) => withStageHistory(buildDeal(body), undefined, req),
  buildUpdate: (body, id, req) => {
    const existing = store.deals.get(id);
    const built = {
      ...buildDeal(body),
      id,
      // The layout is chosen when the deal is created and stays with it.
      layoutName: existing ? existing.layoutName ?? null : body.layoutName ?? null,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    };
    const stamped = existing ? autoCloseDate(existing.stage, built) : built;
    if (existing && existing.stage !== stamped.stage) {
      recordSystemActivity(req, 'Deal update', `${req.user?.name ?? 'Someone'} moved ${stamped.name} to ${stamped.stage}`, 'deals', id);
    }
    return withStageHistory(stamped, existing, req);
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
