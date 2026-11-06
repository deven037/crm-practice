import { Router } from 'express';
import { store } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

export const bootstrapRouter = Router();

function publicUser(u: any) {
  const { password, ...rest } = u;
  return rest;
}

// Bank identity for the app shell; null when the environment has no bank name, so the
// client can show the Harbor default with a plain-language message and Retry.
function bankProfile() {
  const name = process.env.BANK_NAME?.trim();
  if (!name) return null;
  return {
    name,
    logoUrl: process.env.BANK_LOGO_URL?.trim() || null,
    color: process.env.BANK_COLOR?.trim() || null,
  };
}

// One combined payload shaped like buildSeedData()'s return value, for the client's
// initStore() to pre-warm its cache with every collection at boot.
bootstrapRouter.get('/', requireAuth, (_req, res) => {
  res.json({
    bankProfile: bankProfile(),
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
    roleDefs: store.roleDefs.all(),
    assignmentRules: store.assignmentRules.all(),
    dedupeRules: store.dedupeRules.all(),
    statusCodeSets: store.statusCodeSets.all(),
    slaConfigs: store.slaConfigs.all(),
    pageLayouts: store.pageLayouts.all(),
    autoFlowProcesses: store.autoFlowProcesses.all(),
    audit: store.audit.all(),
  });
});
