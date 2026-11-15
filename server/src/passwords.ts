import bcrypt from 'bcryptjs';
import { env } from './env.js';

/** Passwords are stored only as bcrypt hashes; the plain text is never kept. */
export function hashPassword(plain: string): string {
  return bcrypt.hashSync(plain, env.bcryptRounds);
}

// Compared against when no user matches, so a wrong email takes as long as a wrong password.
const DUMMY_HASH = bcrypt.hashSync('no-such-user', env.bcryptRounds);

export async function verifyPassword(plain: string, hash: string | undefined): Promise<boolean> {
  const usable = typeof hash === 'string' && hash.startsWith('$2');
  const matches = await bcrypt.compare(plain, usable ? hash : DUMMY_HASH);
  return usable && matches;
}

/** A value that can never match any password: for sample users nobody signs in as. */
export const UNUSABLE_PASSWORD = '!';

/** At least 8 characters with a letter and a number. */
export function passwordProblem(plain: string): string | null {
  if (plain.length < 8) return 'Password must be at least 8 characters.';
  if (!/[A-Za-z]/.test(plain) || !/[0-9]/.test(plain)) return 'Password must contain a letter and a number.';
  return null;
}

let demoHash: string | undefined;
/** Hash of the documented demo password, computed once per process. */
export function demoPasswordHash(): string {
  demoHash ??= hashPassword('Pass@123');
  return demoHash;
}
