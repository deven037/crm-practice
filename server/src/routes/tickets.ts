import { Router } from 'express';
import { store, newId } from '../db.js';
import { crudRouter } from './crud.js';
import { z } from 'zod';
import { ticketSchema, ticketTransitionSchema, ticketCommentSchema } from '../schemas/ticket.js';
import { TICKET_PRIORITIES } from '../types.js';

const ticketPrioritySchema = z.object({ priority: z.enum(TICKET_PRIORITIES as [string, ...string[]]) });
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { notFound, conflict } from '../errors.js';
import { Ticket, TICKET_TRANSITIONS } from '../types.js';

function buildTicket(body: any): Ticket {
  return {
    id: body.id ?? newId('ticket'),
    subject: body.subject,
    description: body.description ?? '',
    requester: body.requester,
    priority: body.priority ?? 'Medium',
    status: body.status ?? 'Open',
    slaDue: body.slaDue ?? new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date().toISOString(),
    comments: body.comments ?? [],
    attachments: body.attachments ?? [],
    customFields: body.customFields,
  };
}

export const ticketsRouter: Router = crudRouter<Ticket>({
  collection: store.tickets,
  entityLabel: 'Ticket',
  auditAction: 'ticket',
  createSchema: ticketSchema,
  buildCreate: (body) => buildTicket(body),
  buildUpdate: (body, id) => ({ ...buildTicket(body), id, createdAt: store.tickets.get(id)?.createdAt ?? new Date().toISOString() }),
  describe: (t) => `"${t.subject}"`,
});

// Only Closed tickets can be deleted, mirroring TicketDetail.tsx's delete-blocked banner.
ticketsRouter.delete('/:id', requireAuth, requireRole('admin', 'rep'), (req, res) => {
  const ticket = store.tickets.get(req.params.id);
  if (!ticket) throw notFound('Ticket');
  if (ticket.status !== 'Closed') {
    throw conflict('not_closed', 'Only Closed tickets can be deleted.');
  }
  store.tickets.remove(ticket.id);
  store.logAudit(req.user!.name, 'ticket.delete', `Deleted ticket "${ticket.subject}"`);
  res.status(204).end();
});

ticketsRouter.post(
  '/:id/transition',
  requireAuth,
  requireRole('admin', 'rep'),
  validateBody(ticketTransitionSchema),
  (req, res) => {
    const ticket = store.tickets.get(req.params.id);
    if (!ticket) throw notFound('Ticket');
    const { status } = req.body as { status: Ticket['status'] };
    if (!TICKET_TRANSITIONS[ticket.status].includes(status)) {
      throw conflict('illegal_transition', `Cannot move ticket from ${ticket.status} to ${status}.`);
    }
    const from = ticket.status;
    const updated = store.tickets.update(ticket.id, { status })!;
    store.logAudit(req.user!.name, 'ticket.status', `Ticket #${ticket.id} moved ${from} → ${status}`);
    res.json(updated);
  }
);

ticketsRouter.post(
  '/:id/priority',
  requireAuth,
  requireRole('admin', 'rep'),
  validateBody(ticketPrioritySchema),
  (req, res) => {
    const ticket = store.tickets.get(req.params.id);
    if (!ticket) throw notFound('Ticket');
    const { priority } = req.body as { priority: Ticket['priority'] };
    const updated = store.tickets.update(ticket.id, { priority })!;
    store.logAudit(req.user!.name, 'ticket.priority', `Ticket #${ticket.id} priority set to ${priority}`);
    res.json(updated);
  }
);

ticketsRouter.post(
  '/:id/comments',
  requireAuth,
  requireRole('admin', 'rep'),
  validateBody(ticketCommentSchema),
  (req, res) => {
    const ticket = store.tickets.get(req.params.id);
    if (!ticket) throw notFound('Ticket');
    const { text } = req.body as { text: string };
    const comment = { id: newId('tcomment'), author: req.user!.name, text, createdAt: new Date().toISOString() };
    const updated = store.tickets.update(ticket.id, { comments: [...ticket.comments, comment] })!;
    store.logAudit(req.user!.name, 'ticket.comment', `Comment added to ticket #${ticket.id}`);
    res.status(201).json(updated);
  }
);
