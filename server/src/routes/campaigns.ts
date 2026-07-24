import { Router } from 'express';
import { store, newId } from '../db.js';
import { crudRouter } from './crud.js';
import { campaignSchema } from '../schemas/campaign.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { notFound } from '../errors.js';
import { Campaign } from '../types.js';

function buildCampaign(body: any): Campaign {
  return {
    id: body.id ?? newId('campaign'),
    name: body.name,
    channel: body.channel ?? 'Email',
    budget: body.budget,
    startDate: body.startDate,
    endDate: body.endDate,
    status: body.status ?? 'Planned',
    createdAt: new Date().toISOString(),
    customFields: body.customFields,
  };
}

export const campaignsRouter: Router = crudRouter<Campaign>({
  collection: store.campaigns,
  entityLabel: 'Campaign',
  auditAction: 'campaign',
  createSchema: campaignSchema,
  buildCreate: (body) => buildCampaign(body),
  buildUpdate: (body, id) => ({ ...buildCampaign(body), id, createdAt: store.campaigns.get(id)?.createdAt ?? new Date().toISOString() }),
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
