import { Router } from 'express';
import { store } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

export const bootstrapRouter = Router();

function publicUser(u: any) {
  const { password, ...rest } = u;
  return rest;
}

// One combined payload shaped like buildSeedData()'s return value, for the client's
// initStore() to pre-warm its cache with every collection at boot.
bootstrapRouter.get('/', requireAuth, (_req, res) => {
  res.json({
    users: store.users.all().map(publicUser),
    accounts: store.accounts.all(),
    products: store.products.all(),
    leads: store.leads.all(),
    contacts: store.contacts.all(),
    deals: store.deals.all(),
    tasks: store.tasks.all(),
    tickets: store.tickets.all(),
    activities: store.activities.all(),
    notifications: store.notifications.all(),
    campaigns: store.campaigns.all(),
    quotes: store.quotes.all(),
    customFieldDefs: store.customFieldDefs.all(),
    layouts: store.layouts.all(),
    audit: store.audit.all(),
  });
});
