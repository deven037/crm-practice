import { Router } from 'express';
import { env } from '../env.js';
import { notFound } from '../errors.js';
import { DEMO_BANK_ID } from '../banks.js';
import { getBankStore } from '../tenancy.js';
import { resetLimiter } from '../middleware/rateLimiter.js';

export const resetRouter = Router();

// No sign-in needed by design: test suites reset state as their first step, before
// they have a token. It restores the public demo bank's fixed sample data and
// touches no other bank. Rate limited against accidental spam.
resetRouter.post('/', resetLimiter, async (_req, res, next) => {
  try {
    if (!env.demoOpenRoutes) throw notFound();
    const bankStore = await getBankStore(DEMO_BANK_ID);
    bankStore.store.reset();
    await bankStore.flush();
    res.json({ ok: true, seededAt: new Date().toISOString() });
  } catch (error) {
    next(error);
  }
});
