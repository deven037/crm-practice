import { Router } from 'express';
import { store, newId } from '../db.js';
import { crudRouter } from './crud.js';
import { leadSchema, leadConvertSchema } from '../schemas/lead.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { notFound, conflict } from '../errors.js';
import { Account, Contact, Deal, Lead } from '../types.js';

function buildLead(body: any): Lead {
  return {
    id: body.id ?? newId('lead'),
    name: body.name,
    company: body.company ?? '',
    email: body.email,
    phone: body.phone ?? '',
    status: body.status ?? 'New',
    source: body.source ?? 'Web',
    ownerId: body.ownerId,
    value: body.value ?? 0,
    productId: body.productId ?? null,
    campaignId: body.campaignId ?? null,
    createdAt: new Date().toISOString(),
    customFields: body.customFields,
  };
}

export const leadsRouter: Router = crudRouter<Lead>({
  collection: store.leads,
  entityLabel: 'Lead',
  auditAction: 'lead',
  createSchema: leadSchema,
  buildCreate: (body) => buildLead(body),
  buildUpdate: (body, id) => ({ ...buildLead(body), id, createdAt: store.leads.get(id)?.createdAt ?? new Date().toISOString() }),
});

leadsRouter.delete('/:id', requireAuth, requireRole('admin', 'rep'), (req, res) => {
  const lead = store.leads.get(req.params.id);
  if (!lead) throw notFound('Lead');
  store.leads.remove(req.params.id);
  store.logAudit(req.user!.name, 'lead.delete', `Deleted lead ${lead.name}`);
  res.status(204).end();
});

leadsRouter.post(
  '/:id/convert',
  requireAuth,
  requireRole('admin', 'rep'),
  validateBody(leadConvertSchema),
  (req, res) => {
    const lead = store.leads.get(req.params.id);
    if (!lead) throw notFound('Lead');
    if (lead.status === 'Converted') throw conflict('already_converted', 'Lead is already converted.');

    const body = req.body as {
      accountMode: 'new' | 'existing';
      existingAccountId?: string;
      accountName?: string;
      contactName: string;
      contactEmail: string;
      contactPhone: string;
      createDeal: boolean;
      dealName?: string;
      dealAmount?: number;
      dealStage?: Deal['stage'];
    };

    let account: Account;
    if (body.accountMode === 'existing' && body.existingAccountId) {
      const existing = store.accounts.get(body.existingAccountId);
      if (!existing) throw notFound('Account');
      account = existing;
    } else {
      account = {
        id: newId('account'),
        name: body.accountName || lead.company,
        industry: 'Technology',
        employees: 0,
        revenue: 0,
        website: '',
        phone: body.contactPhone,
        ownerId: lead.ownerId,
        createdAt: new Date().toISOString(),
      };
      store.accounts.create(account);
    }

    const contact: Contact = {
      id: newId('contact'),
      name: body.contactName,
      email: body.contactEmail,
      phone: body.contactPhone,
      accountId: account.id,
      title: '',
      tags: ['imported'],
      avatar: null,
      notes: [],
      files: [],
      createdAt: new Date().toISOString(),
    };
    store.contacts.create(contact);

    let deal: Deal | undefined;
    if (body.createDeal) {
      deal = {
        id: newId('deal'),
        name: body.dealName || `${lead.name} Deal`,
        accountId: account.id,
        amount: body.dealAmount ?? 0,
        stage: body.dealStage ?? 'Qualification',
        closeDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        probability: 20,
        ownerId: lead.ownerId,
        campaignId: lead.campaignId ?? null,
        createdAt: new Date().toISOString(),
      };
      store.deals.create(deal);
    }

    const updatedLead = store.leads.update(lead.id, { status: 'Converted' })!;
    store.logAudit(req.user!.name, 'lead.convert', `Converted lead ${lead.name}`);

    res.json({ lead: updatedLead, account, contact, deal });
  }
);
