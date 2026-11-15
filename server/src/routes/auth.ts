import { Request, Router } from 'express';
import { store } from '../db.js';
import { env } from '../env.js';
import { bankInactiveError, requireAuth, signToken } from '../middleware/auth.js';
import { loginLimiter } from '../middleware/rateLimiter.js';
import { validateBody } from '../middleware/validate.js';
import { loginSchema, forgotPasswordSchema, identifySchema } from '../schemas/auth.js';
import { ApiError, unauthorized } from '../errors.js';
import { User } from '../types.js';
import { Bank, DEMO_BANK_ID, bankByName, banksForDomain, emailDomain, getBank, publicBank } from '../banks.js';
import { getBankStore } from '../tenancy.js';
import { hashPassword, verifyPassword } from '../passwords.js';

export const authRouter = Router();

function publicUser(user: User) {
  const { password, ...rest } = user;
  return rest;
}

export function apiBase(req: Request): string {
  return env.publicApiUrl || `${req.protocol}://${req.get('host')}`;
}

const invalidCredentials = () => new ApiError(401, 'invalid_credentials', 'Invalid email or password.');

/**
 * Step one of sign-in: which bank does this email belong to? The answer comes from
 * the email's domain, which a bank registered. It does not depend on whether the
 * person has an account, so it cannot be used to find out who does.
 */
authRouter.post('/identify', loginLimiter, validateBody(identifySchema), async (req, res, next) => {
  try {
    const banks = await banksForDomain(emailDomain(req.body.email));
    res.json({ banks: banks.map((bank) => publicBank(bank, apiBase(req))) });
  } catch (error) {
    next(error);
  }
});

async function banksForLogin(body: { email: string; bankId?: string; bankName?: string }): Promise<Bank[]> {
  if (body.bankId) {
    const bank = await getBank(body.bankId);
    return bank && bank.status !== 'rejected' ? [bank] : [];
  }
  if (body.bankName) {
    const bank = await bankByName(body.bankName);
    return bank ? [bank] : [];
  }
  return banksForDomain(emailDomain(body.email));
}

authRouter.post('/login', loginLimiter, validateBody(loginSchema), async (req, res, next) => {
  try {
    const body = req.body as { email: string; password: string; bankId?: string; bankName?: string };
    const email = body.email.trim().toLowerCase();
    const candidates = await banksForLogin(body);

    if (candidates.length === 0) {
      await verifyPassword(body.password, undefined);
      throw invalidCredentials();
    }
    if (candidates.length > 1) {
      throw new ApiError(409, 'bank_required', 'Choose your bank to continue.', {
        banks: candidates.map((bank) => publicBank(bank, apiBase(req))),
      });
    }

    const bank = candidates[0];
    const bankStore = await getBankStore(bank.id);
    const found = bankStore.store.users.all().find((u) => u.email.toLowerCase() === email);
    const passwordOk = await verifyPassword(body.password, found?.password);
    if (!found || !passwordOk) throw invalidCredentials();

    // Only someone with a valid password learns the state of their bank or account.
    if (bank.status !== 'active') throw bankInactiveError(bank);
    if (!found.active) {
      throw new ApiError(403, 'account_deactivated', 'This account has been deactivated. Contact your administrator.');
    }

    const token = signToken(found, bank.id);
    bankStore.store.logAudit(found.name, 'login', `${found.name} signed in`);
    await bankStore.flush();
    res.json({ token, user: publicUser(found), bank: publicBank(bank, apiBase(req)) });
  } catch (error) {
    next(error);
  }
});

// The practice app let anyone set a new password with only an email address. That
// stays for the public demo bank (its users and password are published anyway) and
// is closed for every real bank. Always 200, so it never says whether an email exists.
authRouter.post('/forgot-password', loginLimiter, validateBody(forgotPasswordSchema), async (req, res, next) => {
  try {
    const { email, newPassword } = req.body as { email: string; newPassword: string };
    if (env.demoOpenRoutes && emailDomain(email) === 'crm.com') {
      const bankStore = await getBankStore(DEMO_BANK_ID);
      const found = bankStore.store.users.all().find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
      if (found) {
        bankStore.store.users.update(found.id, { password: hashPassword(newPassword) });
        bankStore.store.logAudit(found.name, 'password.reset', `${found.name} reset their password`);
        await bankStore.flush();
      }
    }
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

authRouter.get('/me', requireAuth, (req, res) => {
  const found = store.users.get(req.user!.id);
  if (!found) throw unauthorized('User no longer exists.');
  res.json(publicUser(found));
});
