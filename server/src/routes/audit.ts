import { Router } from 'express';
import { store } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

export const auditRouter = Router();

// Read-only: entries are written internally by other routes only, never via POST/PUT/DELETE here.
auditRouter.get('/', requireAuth, requireRole('admin', 'rep'), (req, res) => {
  res.json(store.audit.list(req.query as any));
});
