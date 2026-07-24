import { Router } from 'express';
import { store } from '../db.js';
import { requireAuth, signToken } from '../middleware/auth.js';
import { loginLimiter } from '../middleware/rateLimiter.js';
import { validateBody } from '../middleware/validate.js';
import { loginSchema, forgotPasswordSchema } from '../schemas/auth.js';
import { ApiError, unauthorized } from '../errors.js';
import { User } from '../types.js';

export const authRouter = Router();

function publicUser(user: User) {
  const { password, ...rest } = user;
  return rest;
}

authRouter.post('/login', loginLimiter, validateBody(loginSchema), (req, res) => {
  const { email, password } = req.body as { email: string; password: string; remember?: boolean };
  const found = store.users
    .all()
    .find((u) => u.email.toLowerCase() === email.trim().toLowerCase() && u.password === password);

  if (!found) throw new ApiError(401, 'invalid_credentials', 'Invalid email or password.');
  if (!found.active) {
    throw new ApiError(403, 'account_deactivated', 'This account has been deactivated. Contact your administrator.');
  }

  const token = signToken(found);
  store.logAudit(found.name, 'login', `${found.name} signed in`);
  res.json({ token, user: publicUser(found) });
});

// Unauthenticated by design — the whole point of forgot-password is that the caller
// doesn't have a token yet. No user-enumeration hint: always returns 200 regardless
// of whether the email matched a real account.
authRouter.post('/forgot-password', validateBody(forgotPasswordSchema), (req, res) => {
  const { email, newPassword } = req.body as { email: string; newPassword: string };
  const found = store.users.all().find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
  if (found) {
    store.users.update(found.id, { password: newPassword });
    store.logAudit(found.name, 'password.reset', `${found.name} reset their password`);
  }
  res.json({ ok: true });
});

authRouter.get('/me', requireAuth, (req, res) => {
  const found = store.users.get(req.user!.id);
  if (!found) throw unauthorized('User no longer exists.');
  res.json(publicUser(found));
});
