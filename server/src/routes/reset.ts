import { Router } from 'express';
import { store } from '../db.js';
import { resetLimiter } from '../middleware/rateLimiter.js';

export const resetRouter = Router();

// No auth required by design — this mirrors the client's pre-login ?reset=true flow,
// and lets a Postman/pytest suite reset state as its first step before it has a token.
// Only restores the fixed, publicly-documented deterministic seed, so there's nothing
// to protect. Rate-limited purely against accidental spam, not as an access gate.
resetRouter.post('/', resetLimiter, (_req, res) => {
  store.reset();
  res.json({ ok: true, seededAt: new Date().toISOString() });
});
