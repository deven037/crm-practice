import { Router } from 'express';
import { store, newId } from '../db.js';
import { crudRouter } from './crud.js';
import { contactSchema } from '../schemas/contact.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { notFound } from '../errors.js';
import { Contact } from '../types.js';

function buildContact(body: any): Contact {
  return {
    id: body.id ?? newId('contact'),
    name: body.name,
    email: body.email,
    phone: body.phone ?? '',
    accountId: body.accountId ?? null,
    title: body.title ?? '',
    tags: body.tags ?? [],
    avatar: body.avatar ?? null,
    notes: body.notes ?? [],
    files: body.files ?? [],
    layoutName: body.layoutName ?? null,
    createdAt: new Date().toISOString(),
    customFields: body.customFields,
  };
}

export const contactsRouter: Router = crudRouter<Contact>({
  collection: store.contacts,
  entityLabel: 'Contact',
  auditAction: 'contact',
  createSchema: contactSchema,
  buildCreate: (body) => buildContact(body),
  buildUpdate: (body, id) => {
    const existing = store.contacts.get(id);
    return { ...buildContact(body), id, layoutName: existing?.layoutName ?? null, createdAt: existing?.createdAt ?? new Date().toISOString() };
  },
});

contactsRouter.delete('/:id', requireAuth, requireRole('admin', 'rep'), (req, res) => {
  const contact = store.contacts.get(req.params.id);
  if (!contact) throw notFound('Contact');
  store.contacts.remove(req.params.id);
  store.logAudit(
    req.user!.name,
    'contact.delete',
    `Deleted contact ${contact.name} (${contact.notes.length} note(s), ${contact.files.length} file(s))`
  );
  res.status(204).end();
});
