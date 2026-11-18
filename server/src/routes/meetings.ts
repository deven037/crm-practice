import { Router } from 'express';
import { newId, store } from '../db.js';
import { crudRouter } from './crud.js';
import { meetingSchema } from '../schemas/meeting.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { notFound } from '../errors.js';
import { Meeting } from '../types.js';

function buildMeeting(body: any, ownerId: string, createdAt: string): Meeting {
  const attendees: string[] = [...new Set<string>([ownerId, ...(body.attendeeIds ?? [])])];
  return {
    id: body.id ?? newId('meeting'),
    title: body.title,
    type: body.type ?? 'Meeting',
    start: body.start,
    durationMin: body.durationMin,
    ownerId,
    attendeeIds: attendees,
    contactIds: [...new Set<string>(body.contactIds ?? [])],
    recordModule: body.recordId ? body.recordModule ?? null : null,
    recordId: body.recordId ?? null,
    location: body.location ?? '',
    reminder: body.reminder ?? '15 minutes before',
    notes: body.notes ?? '',
    createdAt,
  };
}

export const meetingsRouter: Router = crudRouter<Meeting>({
  collection: store.meetings,
  entityLabel: 'Meeting',
  auditAction: 'meeting',
  createSchema: meetingSchema,
  buildCreate: (body, req) => buildMeeting(body, body.ownerId ?? req.user!.id, new Date().toISOString()),
  buildUpdate: (body, id, req) => {
    const existing = store.meetings.get(id);
    return { ...buildMeeting(body, existing?.ownerId ?? body.ownerId ?? req.user!.id, existing?.createdAt ?? new Date().toISOString()), id };
  },
  describe: (m) => m.title,
});

meetingsRouter.delete('/:id', requireAuth, requireRole('admin', 'rep'), (req, res) => {
  const meeting = store.meetings.get(req.params.id);
  if (!meeting) throw notFound('Meeting');
  store.meetings.remove(meeting.id);
  store.logAudit(req.user!.name, 'meeting.delete', `Deleted meeting ${meeting.title}`);
  res.status(204).end();
});
