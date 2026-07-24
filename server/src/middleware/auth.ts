import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../env.js';
import { unauthorized, forbidden } from '../errors.js';
import { Role } from '../types.js';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function signToken(user: { id: string; name: string; email: string; role: Role }): string {
  return jwt.sign({ sub: user.id, role: user.role, name: user.name, email: user.email }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn as jwt.SignOptions['expiresIn'],
  });
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;
  if (!token) throw unauthorized('Missing bearer token.');
  try {
    const payload = jwt.verify(token, env.jwtSecret) as jwt.JwtPayload;
    req.user = { id: payload.sub as string, name: payload.name, email: payload.email, role: payload.role };
    next();
  } catch {
    throw unauthorized('Invalid or expired token.');
  }
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) throw forbidden();
    next();
  };
}
