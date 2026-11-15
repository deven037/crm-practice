import express, { Router } from 'express';
import { z } from 'zod';
import { store } from '../db.js';
import { ApiError, conflict, notFound } from '../errors.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { assetUploadSchema, bankProfileSchema } from '../schemas/bank.js';
import { AssetKind, bankByName, getBank, parseImage, publicBank, readAsset, removeAsset, saveAsset, updateBankProfile } from '../banks.js';
import { apiBase } from './auth.js';

const wrap =
  (handler: (req: express.Request, res: express.Response) => Promise<unknown>): express.RequestHandler =>
  (req, res, next) => {
    handler(req, res).catch(next);
  };

const isKind = (value: string): value is AssetKind => value === 'logo' || value === 'login';

/** The signed-in user's own bank: its details and branding. Admins may change them. */
export const bankRouter = Router();

bankRouter.get('/', requireAuth, (req, res) => {
  const bank = req.bank!;
  res.json({ ...publicBank(bank, apiBase(req)), displayName: bank.displayName, profile: bank.profile });
});

bankRouter.put(
  '/profile',
  express.json(),
  requireAuth,
  requireRole('admin'),
  validateBody(bankProfileSchema),
  wrap(async (req, res) => {
    const { displayName, ...profile } = req.body as z.infer<typeof bankProfileSchema>;
    const sameName = await bankByName(displayName);
    if (sameName && sameName.id !== req.bank!.id) throw conflict('bank_name_taken', 'A bank with this name is already registered.');
    const bank = await updateBankProfile(req.bank!.id, displayName, { ...profile, website: profile.website || undefined });
    store.logAudit(req.user!.name, 'bank.profile', `${req.user!.name} changed the bank's details`);
    res.json({ ...publicBank(bank, apiBase(req)), displayName: bank.displayName, profile: bank.profile });
  })
);

bankRouter.put(
  '/assets/:kind',
  express.json({ limit: '5mb' }),
  requireAuth,
  requireRole('admin'),
  validateBody(assetUploadSchema),
  wrap(async (req, res) => {
    if (!isKind(req.params.kind)) throw notFound('Image');
    const image = parseImage(req.body.image, req.params.kind);
    if ('problem' in image) throw new ApiError(422, 'invalid_image', image.problem);
    await saveAsset(req.bank!.id, req.params.kind, image);
    store.logAudit(req.user!.name, 'bank.branding', `${req.user!.name} changed the bank's ${req.params.kind === 'logo' ? 'logo' : 'login image'}`);
    res.json(publicBank((await getBank(req.bank!.id, true))!, apiBase(req)));
  })
);

bankRouter.delete(
  '/assets/:kind',
  requireAuth,
  requireRole('admin'),
  wrap(async (req, res) => {
    if (!isKind(req.params.kind)) throw notFound('Image');
    await removeAsset(req.bank!.id, req.params.kind);
    res.status(204).end();
  })
);

/** Images the login page needs before anyone has signed in. Active banks only. */
export const publicRouter = Router();

publicRouter.get(
  '/banks/:id/assets/:kind',
  wrap(async (req, res) => {
    const bank = await getBank(req.params.id);
    const asset = bank?.status === 'active' && isKind(req.params.kind) ? await readAsset(bank.id, req.params.kind) : undefined;
    if (!asset) throw notFound('Image');
    res.setHeader('Content-Type', asset.mime);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // The address carries a version, so a changed image gets a new address.
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.end(asset.bytes);
  })
);
