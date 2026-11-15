import { Request, Router } from 'express';
import { store } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { DEMO_BANK_ID, publicBank } from '../banks.js';
import { apiBase } from './auth.js';

export const bootstrapRouter = Router();

function publicUser(u: any) {
  const { password, ...rest } = u;
  return rest;
}

// Identity of the signed-in user's bank for the app shell: name, logo, colour and region.
function bankProfile(req: Request) {
  const bank = req.bank!;
  const shown = publicBank(bank, apiBase(req));
  return {
    id: bank.id,
    name: bank.displayName,
    // The demo bank may still take its logo from the environment, as before 3.0.
    logoUrl: shown.logoUrl ?? (bank.id === DEMO_BANK_ID ? process.env.BANK_LOGO_URL?.trim() || null : null),
    loginImageUrl: shown.loginImageUrl,
    color: bank.profile.brandColor || null,
    currency: bank.profile.currency,
    locale: bank.profile.locale,
    timezone: bank.profile.timezone,
  };
}

// One combined payload shaped like buildSeedData()'s return value, for the client's
// initStore() to pre-warm its cache with every collection at boot.
bootstrapRouter.get('/', requireAuth, (req, res) => {
  res.json({
    bankProfile: bankProfile(req),
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
