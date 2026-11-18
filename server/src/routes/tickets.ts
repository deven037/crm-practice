import { Request, Router } from 'express';
import { z } from 'zod';
import { store, newId } from '../db.js';
import { crudRouter } from './crud.js';
import {
  ticketAssignSchema,
  ticketCommentSchema,
  ticketEscalateSchema,
  ticketSchema,
  ticketTransitionSchema,
} from '../schemas/ticket.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { ApiError, notFound, conflict } from '../errors.js';
import { Ticket, TicketComment, TicketPriority, TicketStatus, TICKET_PRIORITIES, TICKET_TRANSITIONS } from '../types.js';
import { duesFor, isDone, pauses, rulesOf, statusPatch, usedShare } from '../sla.js';

const ticketPrioritySchema = z.object({ priority: z.enum(TICKET_PRIORITIES as [string, ...string[]]) });

const rules = () => rulesOf(store.slaRules.all());
const configs = () => store.slaConfigs.all();

function systemNote(text: string, req?: Request): TicketComment {
  return { id: newId('tcomment'), author: req?.user?.name ?? 'CRM', authorId: req?.user?.id ?? null, text, createdAt: new Date().toISOString(), kind: 'system' };
}

function userName(id: string | null | undefined): string {
  return (id && store.users.get(id)?.name) || 'nobody';
}

function buildTicket(body: any, req: Request): Ticket {
  const createdAt = new Date().toISOString();
  const r = rules();
  const base: Ticket = {
    id: body.id ?? newId('ticket'),
    subject: body.subject,
    description: body.description ?? '',
    requester: body.requester,
    priority: body.priority ?? 'Medium',
    status: body.status ?? 'Open',
    slaDue: createdAt,
    createdAt,
    comments: [systemNote(`Ticket created from ${body.channel || 'the CRM'} · ${body.priority ?? 'Medium'}`, req)],
    attachments: body.attachments ?? [],
    customFields: body.customFields,
    contactId: body.contactId ?? null,
    accountId: body.accountId ?? null,
    ownerId: body.ownerId ?? null,
    channel: body.channel ?? '',
    category: body.category ?? '',
    layoutName: body.layoutName ?? null,
    firstReplyAt: null,
    pausedAt: null,
    pausedMinutes: 0,
    resolvedAt: null,
    escalation: 0,
    warnedAt: null,
  };
  Object.assign(base, duesFor(base, configs(), r));
  if (pauses(base.status, r)) base.pausedAt = createdAt;
  if (isDone(base.status)) base.resolvedAt = createdAt;
  return base;
}

/** A PUT changes what the person typed; the clock fields stay the server's. A new priority moves the due times. */
function buildUpdate(body: any, id: string, req: Request): Ticket {
  const existing = store.tickets.get(id);
  if (!existing) throw notFound('Ticket');
  const r = rules();
  let next: Ticket = {
    ...existing,
    subject: body.subject,
    description: body.description ?? existing.description,
    requester: body.requester,
    priority: body.priority ?? existing.priority,
    attachments: body.attachments ?? existing.attachments,
    customFields: body.customFields ?? existing.customFields,
    comments: body.comments ?? existing.comments,
    contactId: body.contactId !== undefined ? body.contactId : existing.contactId ?? null,
    accountId: body.accountId !== undefined ? body.accountId : existing.accountId ?? null,
    ownerId: body.ownerId !== undefined ? body.ownerId : existing.ownerId ?? null,
    channel: body.channel ?? existing.channel ?? '',
    category: body.category ?? existing.category ?? '',
    layoutName: body.layoutName !== undefined ? body.layoutName : existing.layoutName ?? null,
  };
  const notes: TicketComment[] = [];
  if (next.priority !== existing.priority) {
    Object.assign(next, duesFor(next, configs(), r));
    next.warnedAt = null;
    notes.push(systemNote(`Priority ${existing.priority} → ${next.priority} · due time moved`, req));
  }
  if (body.status && body.status !== existing.status) {
    next = { ...next, ...statusPatch(next, body.status, Date.now(), r) };
    notes.push(systemNote(`Status ${existing.status} → ${body.status}`, req));
  }
  if ((next.ownerId ?? null) !== (existing.ownerId ?? null)) notes.push(systemNote(`Assigned to ${userName(next.ownerId)}`, req));
  next.comments = [...next.comments, ...notes];
  return next;
}

export const ticketsRouter: Router = crudRouter<Ticket>({
  collection: store.tickets,
  entityLabel: 'Ticket',
  auditAction: 'ticket',
  createSchema: ticketSchema,
  buildCreate: (body, req) => buildTicket(body, req),
  buildUpdate: (body, id, req) => buildUpdate(body, id, req),
  describe: (t) => `"${t.subject}"`,
});

function load(id: string): Ticket {
  const ticket = store.tickets.get(id);
  if (!ticket) throw notFound('Ticket');
  return ticket;
}

/**
 * Applies the bank's SLA rules to every open ticket: the "nearly out of time" warning,
 * escalation on breach and later to level 2, and handing out tickets nobody took.
 * The Tickets page calls it when it opens and every minute while it stays open.
 */
export function runSlaCheck(now = Date.now()): Ticket[] {
  const r = rules();
  const changed: Ticket[] = [];
  const staff = store.users.all().filter((u) => u.active && (u.role === 'admin' || u.role === 'rep'));
  const open = store.tickets.all().filter((t) => !isDone(t.status));
  const load = new Map(staff.map((u) => [u.id, open.filter((t) => t.ownerId === u.id).length]));
  for (const ticket of open) {
    const patch: Partial<Ticket> = {};
    const notes: TicketComment[] = [];
    const due = Date.parse(ticket.slaDue);
    if (!ticket.pausedAt && Number.isFinite(due)) {
      const level = ticket.escalation ?? 0;
      if (r.escalateOnBreach && now > due && level < 1) {
        patch.escalation = 1;
        notes.push(systemNote(`Escalated to level 1 (${userName(r.level1UserId) === 'nobody' ? 'team lead' : userName(r.level1UserId)}) · SLA breached`));
        store.notifications.create({ id: newId('notif'), text: `Ticket "${ticket.subject}" breached its SLA and went to level 1`, read: false, when: new Date(now).toISOString() });
      }
      if (r.escalateOnBreach && r.level2 && now > due + r.level2AfterMinutes * 60_000 && (patch.escalation ?? level) < 2) {
        patch.escalation = 2;
        notes.push(systemNote(`Escalated to level 2 (${userName(r.level2UserId) === 'nobody' ? 'service manager' : userName(r.level2UserId)}) · still open after the breach`));
      }
      if (r.notifyOnWarn && !ticket.warnedAt && now <= due && usedShare(ticket, now) * 100 >= r.warnPercent) {
        patch.warnedAt = new Date(now).toISOString();
        store.notifications.create({ id: newId('notif'), text: `Ticket "${ticket.subject}" has used ${r.warnPercent}% of its SLA time`, read: false, when: new Date(now).toISOString() });
      }
    }
    if (r.autoAssign && !ticket.ownerId && staff.length && now - Date.parse(ticket.createdAt) > r.autoAssignMinutes * 60_000) {
      const pick = [...staff].sort((a, b) => (load.get(a.id) ?? 0) - (load.get(b.id) ?? 0))[0];
      patch.ownerId = pick.id;
      load.set(pick.id, (load.get(pick.id) ?? 0) + 1);
      notes.push(systemNote(`Assigned to ${pick.name} · nobody took it within ${r.autoAssignMinutes} minutes`));
    }
    if (Object.keys(patch).length) {
      changed.push(store.tickets.update(ticket.id, { ...patch, comments: [...ticket.comments, ...notes] })!);
    }
  }
  return changed;
}

ticketsRouter.post('/sla-check', requireAuth, (req, res) => {
  res.json({ changed: runSlaCheck() });
});

// Only Closed tickets can be deleted.
ticketsRouter.delete('/:id', requireAuth, requireRole('admin', 'rep'), (req, res) => {
  const ticket = load(req.params.id);
  if (ticket.status !== 'Closed') {
    throw conflict('not_closed', 'Only Closed tickets can be deleted.');
  }
  store.tickets.remove(ticket.id);
  store.logAudit(req.user!.name, 'ticket.delete', `Deleted ticket "${ticket.subject}"`);
  res.status(204).end();
});

function moveStatus(ticket: Ticket, to: TicketStatus, req: Request, extra: TicketComment[] = []): Ticket {
  if (!TICKET_TRANSITIONS[ticket.status]?.includes(to)) {
    throw conflict('illegal_transition', `Cannot move ticket from ${ticket.status} to ${to}.`);
  }
  const r = rules();
  const patch = statusPatch(ticket, to, Date.now(), r);
  const clock = pauses(to, r) ? ' · SLA clock paused' : ticket.pausedAt && !isDone(to) ? ' · SLA clock running again' : '';
  const note = systemNote(`Status ${ticket.status} → ${to}${clock}`, req);
  const updated = store.tickets.update(ticket.id, { ...patch, comments: [...ticket.comments, ...extra, note] })!;
  store.logAudit(req.user!.name, 'ticket.status', `Ticket #${ticket.id} moved ${ticket.status} → ${to}`);
  return updated;
}

ticketsRouter.post('/:id/transition', requireAuth, requireRole('admin', 'rep'), validateBody(ticketTransitionSchema), (req, res) => {
  const ticket = load(req.params.id);
  const { status, note } = req.body as { status: TicketStatus; note?: string };
  const extra: TicketComment[] = note
    ? [{ id: newId('tcomment'), author: req.user!.name, authorId: req.user!.id, text: note, createdAt: new Date().toISOString(), kind: 'reply' }]
    : [];
  const withReply = note && !ticket.firstReplyAt ? { ...ticket, firstReplyAt: extra[0].createdAt } : ticket;
  if (withReply !== ticket) store.tickets.update(ticket.id, { firstReplyAt: extra[0].createdAt });
  res.json(moveStatus(withReply, status, req, extra));
});

ticketsRouter.post('/:id/priority', requireAuth, requireRole('admin', 'rep'), validateBody(ticketPrioritySchema), (req, res) => {
  const ticket = load(req.params.id);
  const { priority } = req.body as { priority: TicketPriority };
  if (priority === ticket.priority) return res.json(ticket);
  const dues = duesFor({ ...ticket, priority }, configs(), rules());
  const patch: Partial<Ticket> = { priority, slaDue: dues.slaDue, warnedAt: null };
  if (!ticket.firstReplyAt) patch.firstReplyDue = dues.firstReplyDue;
  const note = systemNote(`Priority ${ticket.priority} → ${priority} · due time moved`, req);
  const updated = store.tickets.update(ticket.id, { ...patch, comments: [...ticket.comments, note] })!;
  store.logAudit(req.user!.name, 'ticket.priority', `Ticket #${ticket.id} priority set to ${priority}`);
  res.json(updated);
});

ticketsRouter.post('/:id/comments', requireAuth, requireRole('admin', 'rep'), validateBody(ticketCommentSchema), (req, res) => {
  const ticket = load(req.params.id);
  const { text, kind, thenStatus } = req.body as { text: string; kind: 'reply' | 'note'; thenStatus?: TicketStatus };
  if (thenStatus && !TICKET_TRANSITIONS[ticket.status]?.includes(thenStatus) && !(ticket.status === 'New' && kind === 'reply' && TICKET_TRANSITIONS.Open.includes(thenStatus))) {
    throw conflict('illegal_transition', `Cannot move ticket from ${ticket.status} to ${thenStatus}.`);
  }
  const comment: TicketComment = { id: newId('tcomment'), author: req.user!.name, authorId: req.user!.id, text, createdAt: new Date().toISOString(), kind };
  let updated = store.tickets.update(ticket.id, {
    comments: [...ticket.comments, comment],
    ...(kind === 'reply' && !ticket.firstReplyAt ? { firstReplyAt: comment.createdAt } : {}),
  })!;
  // The first reply opens a new ticket.
  if (kind === 'reply' && updated.status === 'New') updated = moveStatus(updated, 'Open', req);
  if (thenStatus && thenStatus !== updated.status) updated = moveStatus(updated, thenStatus, req);
  store.logAudit(req.user!.name, 'ticket.comment', `${kind === 'note' ? 'Note' : 'Reply'} added to ticket #${ticket.id}`);
  res.status(201).json(updated);
});

ticketsRouter.post('/:id/assign', requireAuth, requireRole('admin', 'rep'), validateBody(ticketAssignSchema), (req, res) => {
  const ticket = load(req.params.id);
  const { ownerId } = req.body as { ownerId: string | null };
  if (ownerId && !store.users.get(ownerId)) throw new ApiError(400, 'unknown_user', 'That person is not in this bank.');
  if ((ticket.ownerId ?? null) === ownerId) return res.json(ticket);
  const note = systemNote(ownerId ? `Assigned to ${userName(ownerId)}` : 'Unassigned', req);
  const updated = store.tickets.update(ticket.id, { ownerId, comments: [...ticket.comments, note] })!;
  store.logAudit(req.user!.name, 'ticket.assign', `Ticket #${ticket.id} assigned to ${userName(ownerId)}`);
  res.json(updated);
});

ticketsRouter.post('/:id/escalate', requireAuth, requireRole('admin', 'rep'), validateBody(ticketEscalateSchema), (req, res) => {
  const ticket = load(req.params.id);
  if (isDone(ticket.status)) throw conflict('ticket_done', 'Resolved and closed tickets cannot be escalated.');
  const { level, reason } = req.body as { level: number; reason: string };
  const note = systemNote(`Escalated to level ${level} · ${reason}`, req);
  const updated = store.tickets.update(ticket.id, { escalation: level, comments: [...ticket.comments, note] })!;
  store.logAudit(req.user!.name, 'ticket.escalate', `Ticket #${ticket.id} escalated to level ${level}`);
  res.json(updated);
});
