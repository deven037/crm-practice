import { Router } from 'express';
import { z } from 'zod';
import { store, newId } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { ApiError, notFound, forbidden, conflict } from '../errors.js';
import { DEMO_BANK_ID } from '../banks.js';
import { demoPasswordHash, hashPassword, passwordProblem } from '../passwords.js';
import { userCreateSchema, userUpdateSchema } from '../schemas/user.js';
import { User } from '../types.js';
import { newInvite, publicUser } from '../userView.js';
import { UNUSABLE_PASSWORD } from '../passwords.js';

export const usersRouter = Router();

usersRouter.get('/', requireAuth, requireRole('admin', 'rep'), (req, res) => {
  const result = store.users.list(req.query as any);
  res.json({ ...result, data: result.data.map(publicUser) });
});

usersRouter.get('/:id', requireAuth, requireRole('admin', 'rep'), (req, res) => {
  const user = store.users.get(req.params.id);
  if (!user) throw notFound('User');
  res.json(publicUser(user));
});

usersRouter.post('/', requireAuth, requireRole('admin', 'rep'), validateBody(userCreateSchema), (req, res) => {
  const body = req.body as z.infer<typeof userCreateSchema>;
  const email = body.email.trim().toLowerCase();
  if (store.users.all().some((u) => u.email.toLowerCase() === email)) {
    throw conflict('email_taken', 'A user with this email already exists.');
  }
  const id = newId('user');
  const user: User = { id, name: body.name, email: body.email, phone: body.phone, password: UNUSABLE_PASSWORD, role: body.role, active: body.active };
  let inviteToken: string | undefined;

  if (req.user!.bankId === DEMO_BANK_ID) {
    // The public demo bank keeps the practice app's behaviour: the documented demo
    // password when none is given, and no forced change.
    user.password = body.password ? hashPassword(body.password) : demoPasswordHash();
  } else if (body.password) {
    // The admin chose a password for this person: it must meet the rules, and the
    // person has to replace it the first time they sign in.
    const problem = passwordProblem(body.password);
    if (problem) throw new ApiError(422, 'validation_error', problem);
    user.password = hashPassword(body.password);
    user.mustChangePassword = true;
  } else {
    // No password: the person sets their own through a one-time invite link.
    const created = newInvite(req.user!.bankId, id);
    user.invite = created.invite;
    inviteToken = created.token;
  }

  store.users.create(user);
  store.logAudit(req.user!.name, 'user.save', `Saved user ${user.name}`);
  // inviteToken is returned once, here, and cannot be read again.
  res.status(201).json({ ...publicUser(user), ...(inviteToken ? { inviteToken, inviteExpiresAt: user.invite!.expiresAt } : {}) });
});

// A fresh "set your password" link for an existing user: for an invite that expired,
// or for someone who forgot their password. Their current password keeps working
// until the link is used. Admins only.
usersRouter.post('/:id/invite', requireAuth, requireRole('admin'), (req, res) => {
  const user = store.users.get(req.params.id);
  if (!user) throw notFound('User');
  if (req.user!.bankId === DEMO_BANK_ID) throw forbidden('The demo bank does not use invite links.');
  const created = newInvite(req.user!.bankId, user.id);
  store.users.update(user.id, { invite: created.invite });
  store.logAudit(req.user!.name, 'user.invite', `Sent ${user.name} a link to set a password`);
  res.json({ inviteToken: created.token, inviteExpiresAt: created.invite.expiresAt });
});

// Self-service edit (Settings.tsx) is allowed for any role; only admin/rep can
// change someone else's record or change role/active flags.
usersRouter.put(
  '/:id',
  requireAuth,
  (req, _res, next) => {
    if (req.user!.id === req.params.id || ['admin', 'rep'].includes(req.user!.role)) return next();
    throw forbidden();
  },
  validateBody(userUpdateSchema),
  (req, res) => {
    const existing = store.users.get(req.params.id);
    if (!existing) throw notFound('User');
    const isPrivileged = ['admin', 'rep'].includes(req.user!.role);
    const body = req.body as { name: string; email: string; phone?: string; role?: User['role']; active?: boolean };
    const updated = store.users.update(req.params.id, {
      name: body.name,
      email: body.email,
      phone: body.phone,
      role: isPrivileged ? body.role ?? existing.role : existing.role,
      active: isPrivileged ? body.active ?? existing.active : existing.active,
    })!;
    store.logAudit(req.user!.name, 'user.save', `Saved user ${updated.name}`);
    res.json(publicUser(updated));
  }
);

usersRouter.post('/:id/toggle-active', requireAuth, requireRole('admin', 'rep'), (req, res) => {
  const user = store.users.get(req.params.id);
  if (!user) throw notFound('User');
  const updated = store.users.update(user.id, { active: !user.active })!;
  store.logAudit(req.user!.name, 'user.toggle', `${updated.active ? 'Activated' : 'Deactivated'} ${user.name}`);
  res.json(publicUser(updated));
});

// DELETE /api/users/:id?reassignTo=<userId> — 409 with owned-record counts if the
// user owns Leads/Accounts/Deals and no reassignTo is given; self-delete is blocked.
usersRouter.delete('/:id', requireAuth, requireRole('admin', 'rep'), (req, res) => {
  const target = store.users.get(req.params.id);
  if (!target) throw notFound('User');
  if (target.id === req.user!.id) throw forbidden('You cannot delete your own account.');

  const ownedLeads = store.leads.all().filter((l) => l.ownerId === target.id);
  const ownedAccounts = store.accounts.all().filter((a) => a.ownerId === target.id);
  const ownedDeals = store.deals.all().filter((d) => d.ownerId === target.id);
  const reassignTo = req.query.reassignTo as string | undefined;

  if (ownedLeads.length + ownedAccounts.length + ownedDeals.length > 0) {
    if (!reassignTo) {
      throw conflict('has_owned_records', 'User owns records; reassign before deleting.', {
        leads: ownedLeads.length,
        accounts: ownedAccounts.length,
        deals: ownedDeals.length,
      });
    }
    if (!store.users.get(reassignTo)) throw notFound('Reassignment target user');
    ownedLeads.forEach((l) => store.leads.update(l.id, { ownerId: reassignTo }));
    ownedAccounts.forEach((a) => store.accounts.update(a.id, { ownerId: reassignTo }));
    ownedDeals.forEach((d) => store.deals.update(d.id, { ownerId: reassignTo }));
  }

  store.users.remove(target.id);
  store.logAudit(
    req.user!.name,
    'user.delete',
    reassignTo ? `Deleted ${target.name}; records reassigned to ${reassignTo}` : `Deleted user ${target.name}`
  );
  res.status(204).end();
});
