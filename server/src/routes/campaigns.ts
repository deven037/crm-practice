import { Router } from 'express';
import { store, newId } from '../db.js';
import { crudRouter } from './crud.js';
import { campaignSchema, campaignSpendSchema, campaignStatusSchema } from '../schemas/campaign.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { conflict, notFound } from '../errors.js';
import { Campaign, CampaignEvent, CampaignStatus } from '../types.js';

/** History lines and spend lines kept per campaign; the oldest go first. */
export const CAMPAIGN_HISTORY_LIMIT = 60;
export const CAMPAIGN_SPEND_LIMIT = 200;

const withEvent = (c: Pick<Campaign, 'history'>, by: string, text: string, amount?: number, at = new Date().toISOString()): CampaignEvent[] =>
  [...(c.history ?? []), { at, by, text, ...(amount !== undefined ? { amount } : {}) }].slice(-CAMPAIGN_HISTORY_LIMIT);

/** Planned until the run starts, Active while it runs. Completed and Cancelled are only set by a person or the end date. */
export function statusFromDates(startDate: string, endDate: string, now = Date.now()): CampaignStatus {
  if (Date.parse(startDate) > now) return 'Planned';
  return Date.parse(endDate) < now ? 'Completed' : 'Active';
}

function buildCampaign(body: any): Campaign {
  return {
    id: body.id ?? newId('campaign'),
    name: body.name,
    channel: body.channel ?? 'Email',
    budget: body.budget,
    startDate: body.startDate,
    endDate: body.endDate,
    status: body.status ?? statusFromDates(body.startDate, body.endDate),
    layoutName: body.layoutName ?? null,
    createdAt: new Date().toISOString(),
    customFields: body.customFields,
    ownerId: body.ownerId ?? null,
    audience: body.audience ?? '',
    targetLeads: body.targetLeads ?? null,
  };
}

export const campaignsRouter: Router = crudRouter<Campaign>({
  collection: store.campaigns,
  entityLabel: 'Campaign',
  auditAction: 'campaign',
  createSchema: campaignSchema,
  buildCreate: (body, req) => {
    const c = buildCampaign(body);
    return { ...c, ownerId: c.ownerId ?? req.user!.id, spent: 0, spendLog: [], cancelReason: null, history: withEvent({}, req.user!.name, 'Created') };
  },
  buildUpdate: (body, id, req) => {
    const existing = store.campaigns.get(id);
    const built = buildCampaign(body);
    let status = built.status;
    // A plain edit of a campaign that has not finished follows its dates, so moving the start into the past starts it.
    if (existing && (body.status === undefined || body.status === existing.status) && (existing.status === 'Planned' || existing.status === 'Active')) {
      status = statusFromDates(built.startDate, built.endDate);
      if (status === 'Completed') status = 'Active';
    }
    const kept = existing ?? ({} as Partial<Campaign>);
    return {
      ...built,
      id,
      status,
      layoutName: kept.layoutName ?? null,
      createdAt: kept.createdAt ?? new Date().toISOString(),
      // Older saves have no owner or plan; keep what was saved when the body leaves them out.
      ownerId: body.ownerId !== undefined ? body.ownerId : kept.ownerId ?? null,
      audience: body.audience !== undefined ? body.audience : kept.audience ?? '',
      targetLeads: body.targetLeads !== undefined ? body.targetLeads : kept.targetLeads ?? null,
      // Written only by the server.
      spent: kept.spent ?? 0,
      spendLog: kept.spendLog ?? [],
      cancelReason: status === 'Cancelled' ? kept.cancelReason ?? null : null,
      history: withEvent(kept, req.user!.name, status !== kept.status && kept.status ? `Edited, now ${status}` : 'Edited'),
    };
  },
});

/** Moves campaigns along by their dates: Planned ones whose start has come are started, Active ones past their end are completed. */
export function refreshCampaigns(now = Date.now()): Campaign[] {
  const changed: Campaign[] = [];
  for (const c of store.campaigns.all()) {
    if (c.status === 'Planned' && Date.parse(c.startDate) <= now) {
      changed.push(store.campaigns.update(c.id, { status: 'Active', history: withEvent(c, 'System', 'Started on its start date', undefined, new Date(now).toISOString()) })!);
    } else if (c.status === 'Active' && Date.parse(c.endDate) < now) {
      changed.push(store.campaigns.update(c.id, { status: 'Completed', history: withEvent(c, 'System', 'Ended on its end date', undefined, new Date(now).toISOString()) })!);
    }
  }
  return changed;
}

// POST /api/campaigns/refresh — GET requests don't save, so the Campaigns page calls this when it opens.
campaignsRouter.post('/refresh', requireAuth, (_req, res) => {
  const changed = refreshCampaigns();
  res.json({ changed: changed.map((c) => c.id) });
});

// POST /api/campaigns/:id/status — Start now, Mark complete, or Cancel with a reason.
campaignsRouter.post('/:id/status', requireAuth, requireRole('admin', 'rep'), validateBody(campaignStatusSchema), (req, res) => {
  const c = store.campaigns.get(req.params.id);
  if (!c) throw notFound('Campaign');
  const { status, reason } = req.body as { status: 'Active' | 'Completed' | 'Cancelled'; reason?: string };
  const who = req.user!.name;
  const nowIso = new Date().toISOString();
  let patch: Partial<Campaign>;
  if (status === 'Active') {
    if (c.status !== 'Planned') throw conflict('not_planned', 'Only a planned campaign can be started.');
    const startDate = Date.parse(c.startDate) > Date.now() ? nowIso : c.startDate;
    patch = { status, startDate, history: withEvent(c, who, Date.parse(c.startDate) > Date.now() ? 'Started early' : 'Started') };
  } else if (status === 'Completed') {
    if (c.status !== 'Active') throw conflict('not_active', 'Only a running campaign can be marked complete.');
    const endDate = Date.parse(c.endDate) > Date.now() ? nowIso : c.endDate;
    patch = { status, endDate, history: withEvent(c, who, 'Marked complete') };
  } else {
    if (c.status !== 'Planned' && c.status !== 'Active') throw conflict('finished', 'This campaign has already finished.');
    const why = reason?.trim() || null;
    patch = { status, cancelReason: why, history: withEvent(c, who, why ? `Cancelled: ${why}` : 'Cancelled') };
  }
  store.logAudit(who, 'campaign.status', `Campaign ${c.name}: ${c.status} -> ${status}`);
  res.json(store.campaigns.update(c.id, patch));
});

// POST /api/campaigns/:id/spend — log money paid out; the campaign's spent is the total of its log.
campaignsRouter.post('/:id/spend', requireAuth, requireRole('admin', 'rep'), validateBody(campaignSpendSchema), (req, res) => {
  const c = store.campaigns.get(req.params.id);
  if (!c) throw notFound('Campaign');
  if (c.status === 'Planned') throw conflict('not_started', 'Spend can be logged once the campaign has started.');
  const amount = Math.round((req.body as { amount: number }).amount);
  const note = ((req.body as { note?: string }).note ?? '').trim();
  const who = req.user!.name;
  const spendLog = [...(c.spendLog ?? []), { amount, at: new Date().toISOString(), by: who, ...(note ? { note } : {}) }].slice(-CAMPAIGN_SPEND_LIMIT);
  const spent = (c.spent ?? 0) + amount;
  store.logAudit(who, 'campaign.spend', `Campaign ${c.name}: spend ${amount} logged`);
  res.json(store.campaigns.update(c.id, { spent, spendLog, history: withEvent(c, who, note ? `Spend logged: ${note}` : 'Spend logged', amount) }));
});

// DELETE /api/campaigns/:id — unlinks both referencing Leads and Deals (campaignId -> null).
campaignsRouter.delete('/:id', requireAuth, requireRole('admin', 'rep'), (req, res) => {
  const campaign = store.campaigns.get(req.params.id);
  if (!campaign) throw notFound('Campaign');

  const leads = store.leads.all().filter((l) => l.campaignId === campaign.id);
  const deals = store.deals.all().filter((d) => d.campaignId === campaign.id);
  leads.forEach((l) => store.leads.update(l.id, { campaignId: null }));
  deals.forEach((d) => store.deals.update(d.id, { campaignId: null }));

  store.campaigns.remove(campaign.id);
  store.logAudit(
    req.user!.name,
    'campaign.delete',
    `Deleted campaign ${campaign.name} (${leads.length} lead(s), ${deals.length} deal(s) unlinked)`
  );
  res.status(204).end();
});
