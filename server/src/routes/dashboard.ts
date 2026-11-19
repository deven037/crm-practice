import { Router } from 'express';
import { z } from 'zod';
import { store } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { DashboardCard, DashboardLayout } from '../types.js';

/** Most cards a layout keeps; more than the Dashboard has, so new card types can be added later. */
export const DASHBOARD_CARD_LIMIT = 40;
export const BANK_LAYOUT_ID = 'bank';
export const userLayoutId = (userId: string) => `user-${userId}`;

export const dashboardLayoutSchema = z.object({
  cards: z
    .array(
      z.object({
        id: z.string().min(1).max(40),
        span: z.number().int().min(1).max(12),
        rows: z.number().int().min(1).max(80).nullable(),
        hidden: z.boolean(),
      })
    )
    .max(DASHBOARD_CARD_LIMIT)
    .refine((cards) => new Set(cards.map((c) => c.id)).size === cards.length, 'Each card can be listed once.'),
});

function save(id: string, userId: string | null, cards: DashboardCard[]): DashboardLayout {
  const row: DashboardLayout = { id, userId, cards, updatedAt: new Date().toISOString() };
  if (store.dashboardLayouts.get(id)) store.dashboardLayouts.replace(id, row);
  else store.dashboardLayouts.create(row);
  return row;
}

/**
 * Dashboard arrangements. Every signed-in person keeps their own; the bank's default is what people see until
 * they change theirs (admins set it). Nothing here is needed for the Dashboard to work: with no rows it uses
 * its built-in arrangement.
 */
export const dashboardRouter: Router = Router();

// GET /api/dashboard/layout — the signed-in person's layout and the bank's default (either may be null).
dashboardRouter.get('/layout', requireAuth, (req, res) => {
  res.json({
    mine: store.dashboardLayouts.get(userLayoutId(req.user!.id)) ?? null,
    bank: store.dashboardLayouts.get(BANK_LAYOUT_ID) ?? null,
  });
});

// PUT /api/dashboard/layout — save the signed-in person's layout. Viewers may arrange their own dashboard too.
dashboardRouter.put('/layout', requireAuth, validateBody(dashboardLayoutSchema), (req, res) => {
  res.json(save(userLayoutId(req.user!.id), req.user!.id, (req.body as { cards: DashboardCard[] }).cards));
});

// DELETE /api/dashboard/layout — drop the person's own layout, so the bank's default applies again.
dashboardRouter.delete('/layout', requireAuth, (req, res) => {
  store.dashboardLayouts.remove(userLayoutId(req.user!.id));
  res.status(204).end();
});

// PUT /api/dashboard/layout/bank — admins set the layout everyone starts with.
dashboardRouter.put('/layout/bank', requireAuth, requireRole('admin'), validateBody(dashboardLayoutSchema), (req, res) => {
  const row = save(BANK_LAYOUT_ID, null, (req.body as { cards: DashboardCard[] }).cards);
  store.logAudit(req.user!.name, 'dashboard.layout', `Set the bank's dashboard layout (${row.cards.filter((c) => !c.hidden).length} cards)`);
  res.json(row);
});
