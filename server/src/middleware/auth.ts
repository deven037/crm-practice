import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../env.js';
import { ApiError, unauthorized, forbidden } from '../errors.js';
import { Role } from '../types.js';
import { Bank, getBank } from '../banks.js';
import { BankStore, getBankStore, saveBeforeResponse } from '../tenancy.js';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  bankId: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
      bank?: Bank;
      bankStore?: BankStore;
      platformAdmin?: { id: string; email: string; name: string };
    }
  }
}

const signOptions = (): jwt.SignOptions => ({ expiresIn: env.jwtExpiresIn as jwt.SignOptions['expiresIn'] });

/** A bank user's token. It names the bank, so it is only ever good for that bank's data. */
export function signToken(user: { id: string; name: string; email: string; role: Role }, bankId: string): string {
  return jwt.sign({ sub: user.id, role: user.role, name: user.name, email: user.email, bank: bankId }, env.jwtSecret, signOptions());
}

export function signPlatformToken(admin: { id: string; email: string; name: string }): string {
  return jwt.sign({ sub: admin.id, email: admin.email, name: admin.name, scope: 'platform' }, env.jwtSecret, signOptions());
}

function readToken(req: Request): jwt.JwtPayload {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;
  if (!token) throw unauthorized('Missing bearer token.');
  try {
    return jwt.verify(token, env.jwtSecret) as jwt.JwtPayload;
  } catch {
    throw unauthorized('Invalid or expired token.');
  }
}

export function bankInactiveError(bank: Bank): ApiError {
  if (bank.status === 'pending') {
    return new ApiError(403, 'bank_pending', `${bank.displayName} is waiting for approval. You can sign in once it is approved.`);
  }
  if (bank.status === 'rejected') {
    return new ApiError(403, 'bank_rejected', `The registration of ${bank.displayName} was not approved.`);
  }
  return new ApiError(403, 'bank_suspended', `${bank.displayName} is suspended. Contact the platform owner.`);
}

async function authenticate(req: Request, res: Response): Promise<BankStore> {
  const payload = readToken(req);
  // A platform owner token is not a bank user's token, and a token with no bank is from before 3.0.
  if (payload.scope === 'platform' || typeof payload.bank !== 'string') throw unauthorized('Invalid or expired token.');

  const bank = await getBank(payload.bank);
  if (!bank) throw unauthorized('Invalid or expired token.');
  if (bank.status !== 'active') throw bankInactiveError(bank);

  const bankStore = await getBankStore(bank.id);
  // The user must still exist and be active in this bank; the role is read fresh, not trusted from the token.
  const user = bankStore.store.users.get(payload.sub as string);
  if (!user || !user.active) throw unauthorized('Invalid or expired token.');

  req.user = { id: user.id, name: user.name, email: user.email, role: user.role, bankId: bank.id };
  req.bank = bank;
  req.bankStore = bankStore;
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) saveBeforeResponse(res, bankStore);
  return bankStore;
}

/**
 * Checks the token, then runs the rest of the request inside the user's bank:
 * from here on `store` (db.ts) is that bank's data and nothing else.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  authenticate(req, res).then((bankStore) => bankStore.run(() => next()), next);
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) throw forbidden();
    next();
  };
}

/** Platform owner only. Runs with no bank selected, so `store` is unreachable here. */
export function requirePlatform(req: Request, _res: Response, next: NextFunction) {
  const payload = readToken(req);
  if (payload.scope !== 'platform') throw forbidden();
  req.platformAdmin = { id: payload.sub as string, email: payload.email, name: payload.name };
  next();
}
