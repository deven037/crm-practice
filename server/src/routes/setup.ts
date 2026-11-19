import { createHash, randomUUID } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { store } from '../db.js';
import { conflict, notFound } from '../errors.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { statusCodeSetSchema } from '../schemas/statusCodeSet.js';
import type { SetupDraft, SetupSnapshot, SetupVersion } from '../types.js';

export const setupRouter = Router();
setupRouter.use(requireAuth, requireRole('admin'));

const revision = z.object({ revision: z.string().min(1) });
const statusSet = statusCodeSetSchema.extend({ id: z.string().min(1) });
const snapshot = z.object({
  statusCodeSets: z.array(statusSet).refine(
    rows => new Set(rows.map(row => row.id)).size === rows.length,
    'Each picklist needs a unique ID.'
  ),
}).strict();

function liveSettings(): SetupSnapshot {
  return { statusCodeSets: store.statusCodeSets.all() };
}

function liveDigest() {
  // Parsing gives the keys a stable order after a PostgreSQL JSONB round trip.
  const canonical = snapshot.parse(liveSettings());
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

function currentRevision() {
  return store.setupDrafts.get('draft')?.revision ??
    `published-${store.setupVersions.all()[0]?.number ?? 0}-${liveDigest()}`;
}

function checkRevision(expected: string) {
  if (expected !== currentRevision()) throw conflict('stale_revision', 'Reload Setup before saving changes.');
}

function saveDraft(settings: SetupSnapshot): SetupDraft {
  const draft: SetupDraft = {
    id: 'draft', revision: randomUUID(), settings,
    baseDigest: store.setupDrafts.get('draft')?.baseDigest ?? liveDigest(),
  };
  store.setupDrafts.seed([draft]);
  return draft;
}

setupRouter.get('/draft', (_req, res) => {
  const draft = store.setupDrafts.get('draft');
  res.json({ revision: currentRevision(), dirty: Boolean(draft), settings: draft?.settings ?? liveSettings() });
});

setupRouter.put('/draft', validateBody(revision.extend({ settings: snapshot })), (req, res) => {
  checkRevision(req.body.revision);
  const draft = saveDraft(req.body.settings);
  res.json({ revision: draft.revision, dirty: true, settings: draft.settings });
});

setupRouter.delete('/draft', validateBody(revision), (req, res) => {
  checkRevision(req.body.revision);
  store.setupDrafts.remove('draft');
  res.sendStatus(204);
});

function recordVersion(settings: SetupSnapshot, author: string, note: string): SetupVersion {
  const number = (store.setupVersions.all()[0]?.number ?? -1) + 1;
  return store.setupVersions.create({
    id: String(number), number, author, note, settings: structuredClone(settings), createdAt: new Date().toISOString(),
  });
}

setupRouter.post('/publish', validateBody(revision.extend({ note: z.string().trim().min(1).max(500) })), (req, res) => {
  checkRevision(req.body.revision);
  const draft = store.setupDrafts.get('draft');
  if (!draft) throw conflict('no_draft', 'Save a draft before publishing.');
  if (draft.baseDigest !== liveDigest()) {
    throw conflict('published_settings_changed', 'Published settings changed. Discard the draft and review the latest settings.');
  }

  if (!store.setupVersions.all().length) recordVersion(liveSettings(), req.user!.name, 'Before first publish');
  const version = recordVersion(draft.settings, req.user!.name, req.body.note);
  store.statusCodeSets.seed(structuredClone(draft.settings.statusCodeSets));
  store.setupDrafts.remove('draft');
  store.setupVersions.removeMany(store.setupVersions.all().slice(20).map(row => row.id));
  store.logAudit(req.user!.name, 'setup.publish', `Published Setup version ${version.number}`);
  res.status(201).json(version);
});

setupRouter.get('/versions', (_req, res) => {
  res.json(store.setupVersions.all().map(({ settings, ...metadata }) => metadata));
});

setupRouter.get('/versions/:id', (req, res) => {
  const version = store.setupVersions.get(req.params.id);
  if (!version) throw notFound('Setup version');
  res.json(version);
});

// Restoring opens an editable draft. Ordinary users see the rollback only after publication.
setupRouter.post('/versions/:id/restore', validateBody(revision), (req, res) => {
  checkRevision(req.body.revision);
  const version = store.setupVersions.get(req.params.id);
  if (!version) throw notFound('Setup version');
  const draft = saveDraft(structuredClone(version.settings));
  res.json({ revision: draft.revision, dirty: true, settings: draft.settings });
});
