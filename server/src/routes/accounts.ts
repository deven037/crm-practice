import { Router } from 'express';
import { store, newId } from '../db.js';
import { crudRouter } from './crud.js';
import { accountSchema } from '../schemas/account.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { notFound } from '../errors.js';
import { Account } from '../types.js';

function buildAccount(body: any): Account {
  return {
    id: body.id ?? newId('account'),
    name: body.name,
    industry: body.industry ?? '',
    employees: body.employees ?? 0,
    revenue: body.revenue ?? 0,
    website: body.website ?? '',
    phone: body.phone ?? '',
    ownerId: body.ownerId,
    createdAt: new Date().toISOString(),
    customFields: body.customFields,
  };
}

export const accountsRouter: Router = crudRouter<Account>({
  collection: store.accounts,
  entityLabel: 'Account',
  auditAction: 'account',
  createSchema: accountSchema,
  buildCreate: (body) => buildAccount(body),
  buildUpdate: (body, id) => ({ ...buildAccount(body), id, createdAt: store.accounts.get(id)?.createdAt ?? new Date().toISOString() }),
});

// DELETE /api/accounts/:id?cascade=true|false (default false = unlink) — mirrors
// AccountDetail.tsx's cascade-vs-unlink modal, with the query param as the mode selector.
accountsRouter.delete('/:id', requireAuth, requireRole('admin', 'rep'), (req, res) => {
  const account = store.accounts.get(req.params.id);
  if (!account) throw notFound('Account');
  const cascade = req.query.cascade === 'true';

  const contacts = store.contacts.all().filter((c) => c.accountId === account.id);
  const deals = store.deals.all().filter((d) => d.accountId === account.id);

  if (cascade) {
    store.contacts.removeMany(contacts.map((c) => c.id));
    store.deals.removeMany(deals.map((d) => d.id));
  } else {
    contacts.forEach((c) => store.contacts.update(c.id, { accountId: null }));
    deals.forEach((d) => store.deals.update(d.id, { accountId: null }));
  }

  store.accounts.remove(account.id);
  store.logAudit(req.user!.name, 'account.delete', `Deleted account ${account.name} (${cascade ? 'cascade' : 'unlink'})`);
  res.status(204).end();
});
