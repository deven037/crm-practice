import { Router } from 'express';
import { store } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { notFound } from '../errors.js';

export const notificationsRouter = Router();

notificationsRouter.get('/', requireAuth, (req, res) => {
  res.json(store.notifications.list(req.query as any));
});

notificationsRouter.post('/:id/read', requireAuth, (req, res) => {
  const n = store.notifications.get(req.params.id);
  if (!n) throw notFound('Notification');
  const updated = store.notifications.update(n.id, { read: true })!;
  res.json(updated);
});

notificationsRouter.post('/mark-all-read', requireAuth, (req, res) => {
  store.notifications.all().forEach((n) => store.notifications.update(n.id, { read: true }));
  res.json({ ok: true });
});
