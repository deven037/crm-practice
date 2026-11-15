import { createHash, randomBytes } from 'node:crypto';
import { User } from './types.js';

/**
 * A user as the API shows it: never the password hash, the invite secret or the
 * sign-out counter. `invitePending` says the person has not set a password yet.
 */
export function publicUser(user: User) {
  const { password, invite, tokenVersion, ...rest } = user;
  return { ...rest, invitePending: Boolean(invite) };
}

const INVITE_DAYS = 7;
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const encode = (value: string) => Buffer.from(value, 'utf8').toString('base64url');
const decode = (value: string) => Buffer.from(value, 'base64url').toString('utf8');

/**
 * A one-time link token for setting a password. Only its hash is stored, so reading
 * the database does not reveal a usable link. The token names the bank and the user
 * so the accept route knows where to look without searching every bank.
 */
export function newInvite(bankId: string, userId: string): { token: string; invite: NonNullable<User['invite']> } {
  const secret = randomBytes(32).toString('base64url');
  return {
    token: `${encode(bankId)}.${encode(userId)}.${secret}`,
    invite: { tokenHash: sha256(secret), expiresAt: new Date(Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000).toISOString() },
  };
}

export function readInviteToken(token: string): { bankId: string; userId: string; secret: string } | null {
  const parts = token.split('.');
  if (parts.length !== 3 || parts.some((part) => !part)) return null;
  try {
    return { bankId: decode(parts[0]), userId: decode(parts[1]), secret: parts[2] };
  } catch {
    return null;
  }
}

export function inviteMatches(user: User | undefined, secret: string): boolean {
  if (!user?.invite) return false;
  if (new Date(user.invite.expiresAt).getTime() < Date.now()) return false;
  return user.invite.tokenHash === sha256(secret);
}
