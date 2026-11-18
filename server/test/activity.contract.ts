import './setup.js';
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import express from 'express';
import { store } from '../src/db.js';
import { demoToken, useDemoBank } from './helpers.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { activitiesRouter } from '../src/routes/activities.js';
import { meetingsRouter } from '../src/routes/meetings.js';
import { tasksRouter } from '../src/routes/tasks.js';
import { dealsRouter } from '../src/routes/deals.js';

let server: Server;
let base = '';
const created = { activities: [] as string[], meetings: [] as string[], tasks: [] as string[], deals: [] as string[] };
const contactId = 'contact-activity-contract';

before(async () => {
  await useDemoBank();
  const app = express();
  app.use(express.json());
  app.use('/api/activities', activitiesRouter);
  app.use('/api/meetings', meetingsRouter);
  app.use('/api/tasks', tasksRouter);
  app.use('/api/deals', dealsRouter);
  app.use(errorHandler);
  server = await new Promise<Server>((resolve) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  base = `http://127.0.0.1:${address.port}`;
  store.contacts.create({ id: contactId, name: 'Kavya Anand', email: '', phone: '', accountId: null, title: '', tags: [], avatar: null, notes: [], files: [], createdAt: '2026-11-01T00:00:00.000Z' });
});

after(async () => {
  if (server) await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  store.contacts.remove(contactId);
  store.meetings.removeMany(created.meetings);
  store.tasks.removeMany(created.tasks);
  store.deals.removeMany(created.deals);
  store.activities.removeMany(store.activities.all().filter((a) => a.recordId === contactId || created.deals.includes(a.recordId ?? '') || created.tasks.some((t) => a.text.includes(t))).map((a) => a.id));
});

const call = async (method: string, path: string, body?: object, role: 'admin' | 'rep' | 'viewer' = 'rep') => {
  const response = await fetch(`${base}/api${path}`, {
    method,
    headers: { Authorization: `Bearer ${demoToken(role)}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, body: response.status === 204 ? null : await response.json() };
};

describe('logging activities', () => {
  it('writes the sentence and who did it on the server', async () => {
    const { status, body } = await call('POST', '/activities', { type: 'Call', recordModule: 'contacts', recordId: contactId, outcome: 'Connected', durationMin: 12, notes: 'Agreed to review pricing.', userName: 'Someone else' });
    assert.equal(status, 201);
    assert.equal(body.text, 'Riya Rep called Kavya Anand');
    assert.equal(body.userName, 'Riya Rep');
    assert.equal(body.recordName, 'Kavya Anand');
    assert.equal(body.system, false);
    assert.equal(body.durationMin, 12);
  });

  it('accepts a type the bank added itself', async () => {
    const { status, body } = await call('POST', '/activities', { type: 'Branch walk-in', recordModule: 'contacts', recordId: contactId });
    assert.equal(status, 201);
    assert.equal(body.text, 'Riya Rep logged a branch walk-in with Kavya Anand');
  });

  it('refuses a record that does not exist, and viewers', async () => {
    assert.equal((await call('POST', '/activities', { type: 'Call', recordModule: 'contacts', recordId: 'nobody' })).status, 404);
    assert.equal((await call('POST', '/activities', { type: 'Call', recordModule: 'contacts', recordId: contactId }, 'viewer')).status, 403);
    assert.equal((await call('POST', '/activities', { type: 'Call' })).status, 422);
  });
});

describe('activities the CRM records itself', () => {
  it('adds a Task done entry when a task is finished, once', async () => {
    const task = { id: 'task-activity-contract', title: 'Send the pricing', dueDate: '2026-11-18T12:00:00.000Z', priority: 'High', completed: false, order: 0, recordModule: 'contacts', recordId: contactId };
    created.tasks.push(task.id);
    const made = await call('POST', '/tasks', task);
    assert.equal(made.body.ownerId, 'user-2');
    await call('PUT', `/tasks/${task.id}`, { ...task, completed: true });
    await call('PUT', `/tasks/${task.id}`, { ...task, completed: true, title: 'Send the pricing' });
    const done = store.activities.all().filter((a) => a.type === 'Task done' && a.text.includes('Send the pricing'));
    assert.equal(done.length, 1);
    assert.equal(done[0].system, true);
    assert.equal(done[0].recordName, 'Kavya Anand');
  });

  it('adds a Deal update entry when a deal changes stage', async () => {
    const deal = { id: 'deal-activity-contract', name: 'Escrow mandate', amount: 1, probability: 20, ownerId: 'user-2', stage: 'Qualification' };
    created.deals.push(deal.id);
    await call('POST', '/deals', deal);
    await call('PUT', `/deals/${deal.id}`, { ...deal, stage: 'Proposal' });
    const updates = store.activities.all().filter((a) => a.type === 'Deal update' && a.recordId === deal.id);
    assert.equal(updates.length, 1);
    assert.equal(updates[0].text, 'Riya Rep moved Escrow mandate to Proposal');
  });
});

describe('meetings', () => {
  it('creates a meeting owned by whoever adds it, with them on the attendee list', async () => {
    const { status, body } = await call('POST', '/meetings', { title: 'Pricing review', type: 'Meeting', start: '2026-11-18T05:30:00.000Z', durationMin: 60, attendeeIds: ['user-1'], recordModule: 'contacts', recordId: contactId });
    assert.equal(status, 201);
    created.meetings.push(body.id);
    assert.equal(body.ownerId, 'user-2');
    assert.deepEqual(body.attendeeIds, ['user-2', 'user-1']);
    assert.equal(body.reminder, '15 minutes before');
  });

  it('moves a meeting and keeps its owner', async () => {
    const id = created.meetings[0];
    const { body } = await call('PUT', `/meetings/${id}`, { title: 'Pricing review', start: '2026-11-19T06:00:00.000Z', durationMin: 45, ownerId: 'user-1' }, 'admin');
    assert.equal(body.start, '2026-11-19T06:00:00.000Z');
    assert.equal(body.ownerId, 'user-2');
  });

  it('rejects a meeting without a time or shorter than 5 minutes, and deletes', async () => {
    assert.equal((await call('POST', '/meetings', { title: 'No time', durationMin: 30 })).status, 422);
    assert.equal((await call('POST', '/meetings', { title: 'Blink', start: '2026-11-18T05:30:00.000Z', durationMin: 2 })).status, 422);
    assert.equal((await call('DELETE', `/meetings/${created.meetings[0]}`)).status, 204);
    assert.equal(store.meetings.get(created.meetings[0]), undefined);
  });
});
