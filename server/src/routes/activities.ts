import { Router } from 'express';
import { store } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

export const activitiesRouter = Router();

// Read-only: activities are system-generated at seed time, never created via the API.
activitiesRouter.get('/', requireAuth, (req, res) => {
  res.json(store.activities.list(req.query as any));
});
