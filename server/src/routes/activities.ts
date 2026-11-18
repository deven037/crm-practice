import { Request, Router } from 'express';
import { newId, store } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { notFound } from '../errors.js';
import { activitySchema } from '../schemas/activity.js';
import { Activity, LinkedModule } from '../types.js';

/** Activities the CRM records itself are trimmed once a bank holds this many in all (storage rule: no endless logs). */
export const ACTIVITY_LIMIT = 5000;

const VERB: Record<string, string> = { Call: 'called', Meeting: 'met with', Visit: 'visited', Email: 'emailed', Note: 'added a note on' };

/** The name of the record an activity is about, or '' when it no longer exists. */
export function recordName(module: LinkedModule | null | undefined, id: string | null | undefined): string {
  if (!module || !id) return '';
  const item = (store[module] as { get: (id: string) => { name?: string } | undefined }).get(id);
  return item?.name ?? '';
}

/** Saves an activity, then trims the oldest CRM-recorded ones if the bank is over the limit. */
export function addActivity(activity: Activity): Activity {
  store.activities.create(activity);
  const all = store.activities.all();
  if (all.length > ACTIVITY_LIMIT) {
    const extra = all.length - ACTIVITY_LIMIT;
    const oldestSystem = all.filter((a) => a.system).sort((a, b) => a.when.localeCompare(b.when)).slice(0, extra);
    store.activities.removeMany(oldestSystem.map((a) => a.id));
  }
  return activity;
}

/** Records something the CRM saw happen (a stage change, a finished task), in the name of whoever did it. */
export function recordSystemActivity(req: Request, type: 'Deal update' | 'Task done', text: string, module?: LinkedModule | null, id?: string | null): void {
  addActivity({
    id: newId('activity'),
    type,
    icon: type,
    text,
    when: new Date().toISOString(),
    userId: req.user?.id,
    userName: req.user?.name ?? 'Someone',
    recordModule: module ?? null,
    recordId: id ?? null,
    recordName: recordName(module, id),
    system: true,
  });
}

export const activitiesRouter = Router();

activitiesRouter.get('/', requireAuth, (req, res) => {
  res.json(store.activities.list(req.query as any));
});

// POST /api/activities: log a call, meeting, visit, email or note. Who logged it comes from the sign-in.
activitiesRouter.post('/', requireAuth, requireRole('admin', 'rep'), validateBody(activitySchema), (req, res) => {
  const body = req.body as { type: string; recordModule: LinkedModule; recordId: string; when?: string; outcome?: string; durationMin?: number | null; notes: string };
  const name = recordName(body.recordModule, body.recordId);
  if (!name) throw notFound('Record');
  const who = req.user?.name ?? 'Someone';
  const verb = VERB[body.type] ?? `logged ${/^[aeiou]/i.test(body.type) ? 'an' : 'a'} ${body.type.toLowerCase()} with`;
  const activity = addActivity({
    id: newId('activity'),
    type: body.type,
    icon: body.type,
    text: `${who} ${verb} ${name}`,
    when: body.when ?? new Date().toISOString(),
    userId: req.user?.id,
    userName: who,
    recordModule: body.recordModule,
    recordId: body.recordId,
    recordName: name,
    outcome: body.outcome ?? '',
    durationMin: body.durationMin ?? null,
    notes: body.notes ?? '',
    system: false,
  });
  store.logAudit(who, 'activity.create', `Logged ${body.type.toLowerCase()} on ${name}`);
  res.status(201).json(activity);
});
