import './setup.js';
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import express from 'express';
import { store } from '../src/db.js';
import { demoToken, useDemoBank } from './helpers.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { runSlaCheck, ticketsRouter } from '../src/routes/tickets.js';
import { slaConfigsRouter } from '../src/routes/slaConfigs.js';
import { addSlaMinutes, DEFAULT_SLA_RULES } from '../src/sla.js';
import type { Ticket } from '../src/types.js';

let server: Server;
let base = '';
const created: string[] = [];

before(async () => {
  await useDemoBank();
  const app = express();
  app.use(express.json());
  app.use('/api/tickets', ticketsRouter);
  app.use('/api/slaConfigs', slaConfigsRouter);
  app.use(errorHandler);
  server = await new Promise<Server>((resolve) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  base = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (server) await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  store.tickets.removeMany(created);
  store.slaRules.removeMany(['sla-rules']);
});

async function call(method: string, path: string, body?: unknown, role: 'admin' | 'rep' | 'viewer' = 'rep') {
  const res = await fetch(`${base}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${demoToken(role)}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

async function newTicket(extra: Record<string, unknown> = {}): Promise<Ticket> {
  const res = await call('POST', '/tickets', { subject: 'UPI collect requests failing', requester: 'Kavya Anand', priority: 'Urgent', status: 'New', channel: 'WhatsApp', category: 'Payments', ...extra });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  created.push(res.body.id);
  return res.body;
}

const minutesBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 60_000);

describe('SLA time', () => {
  it('counts only working hours for a working-hours policy, skipping nights and Sundays', () => {
    // Saturday 21 Nov 2026, 17:00 India time = 11:30 UTC. One working hour: Saturday 17:00-18:00, then nothing.
    const start = Date.UTC(2026, 10, 21, 11, 30);
    assert.equal(new Date(addSlaMinutes(start, 60, 'working', DEFAULT_SLA_RULES)).toISOString(), '2026-11-21T12:30:00.000Z');
    // Two hours: one on Saturday, Sunday is closed, so Monday 09:00-10:00 India time (04:30 UTC).
    assert.equal(new Date(addSlaMinutes(start, 120, 'working', DEFAULT_SLA_RULES)).toISOString(), '2026-11-23T04:30:00.000Z');
    assert.equal(addSlaMinutes(start, 120, '24x7', DEFAULT_SLA_RULES), start + 120 * 60_000);
  });
});

describe('tickets 3.0', () => {
  it('works out due times on the server from the policy and ignores a slaDue sent by the client', async () => {
    const t = await newTicket({ slaDue: '2000-01-01T00:00:00.000Z' });
    assert.equal(minutesBetween(t.createdAt, t.slaDue), 240);
    assert.equal(minutesBetween(t.createdAt, t.firstReplyDue!), 15);
    assert.equal(t.status, 'New');
    assert.equal(t.firstReplyAt, null);
    assert.equal(t.comments.at(-1)?.kind, 'system');
  });

  it('records the first reply, opens a new ticket and can pause the clock in one step', async () => {
    const t = await newTicket();
    const res = await call('POST', `/tickets/${t.id}/comments`, { text: 'Looking into it now.', kind: 'reply', thenStatus: 'Waiting on customer' });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.ok(res.body.firstReplyAt);
    assert.equal(res.body.status, 'Waiting on customer');
    assert.ok(res.body.pausedAt);
    const kinds = res.body.comments.map((c: { kind: string }) => c.kind);
    assert.deepEqual(kinds.slice(-3), ['reply', 'system', 'system']);
  });

  it('keeps internal notes out of the first reply', async () => {
    const t = await newTicket();
    const res = await call('POST', `/tickets/${t.id}/comments`, { text: 'Switch team says limit is zero.', kind: 'note' });
    assert.equal(res.body.firstReplyAt, null);
    assert.equal(res.body.status, 'New');
  });

  it('moves the due time on by the paused time when the pause ends', async () => {
    const t = await newTicket({ status: 'Open' });
    const paused = (await call('POST', `/tickets/${t.id}/transition`, { status: 'Waiting on customer' })).body as Ticket;
    // Pretend the pause started 30 minutes ago.
    store.tickets.update(t.id, { pausedAt: new Date(Date.now() - 30 * 60_000).toISOString() });
    const resumed = (await call('POST', `/tickets/${t.id}/transition`, { status: 'In Progress' })).body as Ticket;
    assert.equal(resumed.pausedAt, null);
    assert.ok(Math.abs((resumed.pausedMinutes ?? 0) - 30) < 1);
    assert.ok(Math.abs(minutesBetween(paused.slaDue, resumed.slaDue) - 30) <= 1);
  });

  it('refuses a status move the workflow does not allow', async () => {
    const t = await newTicket();
    const res = await call('POST', `/tickets/${t.id}/transition`, { status: 'Resolved' });
    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'illegal_transition');
  });

  it('resolves with a note that goes to the customer and stops the clock', async () => {
    const t = await newTicket({ status: 'Open' });
    const res = await call('POST', `/tickets/${t.id}/transition`, { status: 'Resolved', note: 'Limit restored.' });
    assert.equal(res.status, 200);
    assert.ok(res.body.resolvedAt);
    assert.ok(res.body.firstReplyAt);
    assert.ok(res.body.comments.some((c: { kind: string; text: string }) => c.kind === 'reply' && c.text === 'Limit restored.'));
    const reopened = await call('POST', `/tickets/${t.id}/transition`, { status: 'In Progress' });
    assert.equal(reopened.body.resolvedAt, null);
  });

  it('moves the due times when the priority changes', async () => {
    const t = await newTicket();
    const res = await call('POST', `/tickets/${t.id}/priority`, { priority: 'High' });
    assert.equal(minutesBetween(t.createdAt, res.body.slaDue), 480);
    assert.equal(minutesBetween(t.createdAt, res.body.firstReplyDue), 60);
  });

  it('assigns, unassigns and escalates with a line in the conversation', async () => {
    const t = await newTicket();
    assert.equal((await call('POST', `/tickets/${t.id}/assign`, { ownerId: 'user-4' })).body.ownerId, 'user-4');
    assert.equal((await call('POST', `/tickets/${t.id}/assign`, { ownerId: 'nobody-here' })).status, 400);
    const esc = await call('POST', `/tickets/${t.id}/escalate`, { level: 2, reason: 'Customer is the bank’s largest dealer.' });
    assert.equal(esc.body.escalation, 2);
    assert.match(esc.body.comments.at(-1).text, /level 2/);
    assert.equal((await call('POST', `/tickets/${t.id}/escalate`, { level: 1, reason: '' })).status, 422);
  });

  it('keeps the clock fields when a PUT edits the ticket', async () => {
    const t = await newTicket();
    const res = await call('PUT', `/tickets/${t.id}`, { subject: 'UPI collect failing for dealers', requester: 'Kavya Anand', priority: 'Urgent', slaDue: '2000-01-01T00:00:00.000Z', category: 'Cards' });
    assert.equal(res.status, 200);
    assert.equal(res.body.slaDue, t.slaDue);
    assert.equal(res.body.category, 'Cards');
    assert.equal(res.body.subject, 'UPI collect failing for dealers');
  });

  it('escalates breached tickets and hands out tickets nobody took', async () => {
    const t = await newTicket();
    const old = new Date(Date.now() - 6 * 60 * 60_000).toISOString();
    store.tickets.update(t.id, { createdAt: old, slaDue: new Date(Date.now() - 2.5 * 60 * 60_000).toISOString(), ownerId: null });
    const changed = runSlaCheck();
    const after = changed.find((x) => x.id === t.id)!;
    assert.equal(after.escalation, 2);
    assert.ok(after.ownerId);
    assert.ok(after.comments.some((c) => /level 1/.test(c.text)));
    // A second run changes nothing more.
    assert.equal(runSlaCheck().find((x) => x.id === t.id), undefined);
  });

  it('deletes only closed tickets', async () => {
    const t = await newTicket({ status: 'Open' });
    assert.equal((await call('DELETE', `/tickets/${t.id}`)).status, 409);
    await call('POST', `/tickets/${t.id}/transition`, { status: 'Closed' });
    assert.equal((await call('DELETE', `/tickets/${t.id}`)).status, 204);
  });
});

describe('SLA policy', () => {
  it('fills every priority from the standard policy', async () => {
    const res = await call('GET', '/slaConfigs/policy');
    assert.equal(res.body.configs.length, 4);
    assert.deepEqual(res.body.rules.pauseStatuses, ['Waiting on customer']);
  });

  it('lets only admins save, checks the values and recalculates open tickets when asked', async () => {
    const policy = (await call('GET', '/slaConfigs/policy')).body;
    const t = await newTicket({ priority: 'High' });
    const configs = policy.configs.map((c: { priority: string }) => (c.priority === 'High' ? { ...c, hours: 12, firstReplyHours: 2 } : c));
    const { id: _id, ...rules } = policy.rules;
    assert.equal((await call('PUT', '/slaConfigs/policy', { configs, rules, apply: 'all' }, 'rep')).status, 403);
    const bad = await call('PUT', '/slaConfigs/policy', { configs: [{ priority: 'High', hours: 1, firstReplyHours: 2, clock: '24x7' }], rules, apply: 'new' }, 'admin');
    assert.equal(bad.status, 422);
    const ok = await call('PUT', '/slaConfigs/policy', { configs, rules: { ...rules, warnPercent: 75 }, apply: 'all' }, 'admin');
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    assert.equal(ok.body.rules.warnPercent, 75);
    assert.ok(ok.body.moved >= 1);
    assert.equal(minutesBetween(t.createdAt, store.tickets.get(t.id)!.slaDue), 720);
    // Put the standard policy back for the other tests.
    await call('PUT', '/slaConfigs/policy', { configs: policy.configs.map(({ id: _x, ...c }: { id: string }) => c), rules, apply: 'new' }, 'admin');
  });
});
