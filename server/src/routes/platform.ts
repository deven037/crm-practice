import express, { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { env } from '../env.js';
import { ApiError, conflict, notFound } from '../errors.js';
import { requirePlatform, signPlatformToken } from '../middleware/auth.js';
import { loginLimiter } from '../middleware/rateLimiter.js';
import { validateBody } from '../middleware/validate.js';
import { bankRegistrationSchema, decisionSchema, platformLoginSchema } from '../schemas/bank.js';
import {
  AssetKind, Bank, BankStatus, DEMO_BANK_ID, bankByName, createBank, deleteBank, findPlatformAdmin, getBank,
  latestRegistrationFor, listBanks, parseImage, readAsset, recordCounts, saveAsset, setBankStatus,
} from '../banks.js';
import { hashPassword, verifyPassword } from '../passwords.js';

export const platformRouter = Router();

// Registration carries two images, so it gets its own, larger body limit (index.ts
// leaves /api/platform/banks to this parser).
const bigJson = express.json({ limit: '8mb' });
const smallJson = express.json();

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: env.registerRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'rate_limited', message: 'Too many registrations from this network. Try again later.' } },
});

const wrap =
  (handler: (req: express.Request, res: express.Response) => Promise<unknown>): express.RequestHandler =>
  (req, res, next) => {
    handler(req, res).catch(next);
  };

// ---------- open to anyone ----------

/** A bank registers itself. It is saved as pending and cannot be used until the platform owner approves it. */
platformRouter.post(
  '/banks',
  registerLimiter,
  bigJson,
  validateBody(bankRegistrationSchema),
  wrap(async (req, res) => {
    const { admin, logo, loginImage, displayName, ...profile } = req.body as z.infer<typeof bankRegistrationSchema>;

    if (await bankByName(displayName)) {
      throw conflict('bank_name_taken', 'A bank with this name is already registered.');
    }
    const images: [AssetKind, string | undefined][] = [['logo', logo], ['login', loginImage]];
    const parsed: [AssetKind, { mime: string; base64: string }][] = [];
    for (const [kind, dataUrl] of images) {
      if (!dataUrl) continue;
      const image = parseImage(dataUrl, kind);
      if ('problem' in image) throw new ApiError(422, 'invalid_image', image.problem, { field: kind === 'logo' ? 'logo' : 'loginImage' });
      parsed.push([kind, image]);
    }

    const bank = await createBank({
      displayName,
      status: 'pending',
      profile: { ...profile, website: profile.website || undefined },
      admin: { name: admin.name, email: admin.email, passwordHash: hashPassword(admin.password) },
    });
    for (const [kind, image] of parsed) await saveAsset(bank.id, kind, image);

    res.status(201).json({ id: bank.id, name: bank.displayName, status: bank.status });
  })
);

/** Lets the person who registered a bank see whether it has been approved yet. */
platformRouter.get(
  '/registration-status',
  loginLimiter,
  wrap(async (req, res) => {
    const email = String(req.query.email ?? '').trim();
    const bank = email ? await latestRegistrationFor(email) : undefined;
    if (!bank) throw notFound('Registration');
    res.json({ name: bank.displayName, status: bank.status, reason: bank.statusReason, registeredAt: bank.createdAt, decidedAt: bank.decidedAt });
  })
);

platformRouter.post(
  '/login',
  loginLimiter,
  smallJson,
  validateBody(platformLoginSchema),
  wrap(async (req, res) => {
    const admin = await findPlatformAdmin(req.body.email);
    const ok = await verifyPassword(req.body.password, admin?.password_hash);
    if (!admin || !ok) throw new ApiError(401, 'invalid_credentials', 'Invalid email or password.');
    res.json({ token: signPlatformToken(admin), admin: { id: admin.id, email: admin.email, name: admin.name } });
  })
);

// ---------- platform owner only ----------

function consoleBank(bank: Bank, counts: Record<string, number> = {}) {
  const records = Object.entries(counts).reduce((sum, [name, n]) => (name === 'users' || name === 'audit' ? sum : sum + n), 0);
  return { ...bank, users: counts.users ?? 0, records };
}

platformRouter.get(
  '/banks',
  requirePlatform,
  wrap(async (req, res) => {
    const [banks, counts] = await Promise.all([listBanks(), recordCounts()]);
    const status = req.query.status as BankStatus | undefined;
    res.json({ data: banks.filter((bank) => !status || bank.status === status).map((bank) => consoleBank(bank, counts.get(bank.id))) });
  })
);

platformRouter.get(
  '/banks/:id',
  requirePlatform,
  wrap(async (req, res) => {
    const bank = await getBank(req.params.id, true);
    if (!bank) throw notFound('Bank');
    res.json(consoleBank(bank, (await recordCounts()).get(bank.id)));
  })
);

/** The console may look at a bank's images before it is approved; the public route only serves active banks. */
platformRouter.get(
  '/banks/:id/assets/:kind',
  requirePlatform,
  wrap(async (req, res) => {
    const kind = req.params.kind as AssetKind;
    const asset = kind === 'logo' || kind === 'login' ? await readAsset(req.params.id, kind) : undefined;
    if (!asset) throw notFound('Image');
    res.setHeader('Content-Type', asset.mime);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-store');
    res.end(asset.bytes);
  })
);

/** Which moves are allowed from each state. */
const MOVES: Record<string, { from: BankStatus[]; to: BankStatus; needsReason: boolean; done: string }> = {
  approve: { from: ['pending', 'rejected'], to: 'active', needsReason: false, done: 'approved' },
  reject: { from: ['pending'], to: 'rejected', needsReason: true, done: 'rejected' },
  suspend: { from: ['active'], to: 'suspended', needsReason: true, done: 'suspended' },
  reactivate: { from: ['suspended'], to: 'active', needsReason: false, done: 'reactivated' },
};

platformRouter.post(
  '/banks/:id/:action(approve|reject|suspend|reactivate)',
  requirePlatform,
  smallJson,
  validateBody(decisionSchema),
  wrap(async (req, res) => {
    const move = MOVES[req.params.action];
    const bank = await getBank(req.params.id, true);
    if (!bank) throw notFound('Bank');
    if (!move.from.includes(bank.status)) {
      throw conflict('invalid_state', `A bank that is ${bank.status} cannot be ${move.done}.`);
    }
    if (move.needsReason && !req.body.reason) throw new ApiError(422, 'validation_error', 'Give a reason.');
    if (bank.id === DEMO_BANK_ID && move.to !== 'active') throw conflict('demo_bank', 'The demo bank cannot be suspended.');
    res.json(await setBankStatus(bank.id, move.to, req.body.reason));
  })
);

platformRouter.delete(
  '/banks/:id',
  requirePlatform,
  wrap(async (req, res) => {
    if (req.params.id === DEMO_BANK_ID) throw conflict('demo_bank', 'The demo bank cannot be deleted.');
    if (!(await deleteBank(req.params.id))) throw notFound('Bank');
    res.status(204).end();
  })
);
