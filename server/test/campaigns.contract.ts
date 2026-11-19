import './setup.js';
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import express from 'express';
import { store } from '../src/db.js';
import { demoToken, useDemoBank } from './helpers.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { campaignsRouter, refreshCampaigns, statusFromDates } from '../src/routes/campaigns.js';
import { Role } from '../src/types.js';
import { buildSeedData } from '../src/seed.js';

let server: Server;
let base = '';
const made: string[] = [];
const DAY = 86_400_000;
const iso = (days: number) => new Date(Date.now() + days * DAY).toISOString();

before(async () => {
  await useDemoBank();
  const app = express();
  app.use(express.json());
  app.use('/api/campaigns', campaignsRouter);
  app.use(errorHandler);
  server = await new Promise<Server>((resolve) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  base = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (server) await new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())));
  made.forEach((id) => store.campaigns.remove(id));
});

async function call(method: string, path: string, body?: object, role: Role = 'rep') {
  const response = await fetch(`${base}/api${path}`, {
    method,
    headers: { Authorization: `Bearer ${demoToken(role)}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

const plan = (start: number, end: number, extra: object = {}) => ({ name: `Contract campaign ${start}`, channel: 'Email', budget: 50000, startDate: iso(start), endDate: iso(end), ...extra });

async function create(start: number, end: number, extra: object = {}) {
  const res = await call('POST', '/campaigns', plan(start, end, extra));
  assert.equal(res.status, 201, JSON.stringify(res.body));
  made.push(res.body.id);
  return res.body;
}

describe('campaigns 3.0', () => {
  it('sets the status from the dates and keeps the plan fields', async () => {
    const later = await create(10, 40, { targetLeads: 80, audience: 'SME owners in Pune' });
    assert.equal(later.status, 'Planned');
    assert.equal(later.targetLeads, 80);
    assert.equal(later.audience, 'SME owners in Pune');
    assert.equal(later.ownerId, 'user-2', 'the creator owns it when no owner is sent');
    assert.equal(later.spent, 0);
    assert.deepEqual(later.history.map((h: { text: string }) => h.text), ['Created']);

    const now = await create(-3, 20, { ownerId: 'user-4' });
    assert.equal(now.status, 'Active');
    assert.equal(now.ownerId, 'user-4');
    assert.equal(statusFromDates(iso(-30), iso(-2)), 'Completed');
  });

  it('starts a planned campaign when an edit moves its start into the past, and never takes spend from the body', async () => {
    const c = await create(5, 30);
    const edited = await call('PUT', `/campaigns/${c.id}`, { ...plan(-1, 30), status: 'Planned', spent: 999999, spendLog: [{ amount: 1 }] });
    assert.equal(edited.status, 200);
    assert.equal(edited.body.status, 'Active');
    assert.equal(edited.body.spent, 0);
    assert.deepEqual(edited.body.spendLog, []);
    assert.equal(edited.body.ownerId, 'user-2', 'an edit without an owner keeps the saved one');
    assert.equal(edited.body.history.at(-1).text, 'Edited, now Active');
  });

  it('logs spend into a total, only once the campaign has started', async () => {
    const planned = await create(7, 30);
    const early = await call('POST', `/campaigns/${planned.id}/spend`, { amount: 1000 });
    assert.equal(early.status, 409);
    assert.equal(early.body.error.code, 'not_started');

    const running = await create(-5, 30);
    await call('POST', `/campaigns/${running.id}/spend`, { amount: 25000, note: 'Agency invoice' });
    const second = await call('POST', `/campaigns/${running.id}/spend`, { amount: 4999.6 });
    assert.equal(second.status, 200);
    assert.equal(second.body.spent, 30000);
    assert.equal(second.body.spendLog.length, 2);
    assert.equal(second.body.spendLog[0].note, 'Agency invoice');
    assert.equal(second.body.history.at(-1).amount, 5000);
    assert.equal(second.body.history.at(-2).text, 'Spend logged: Agency invoice');

    const bad = await call('POST', `/campaigns/${running.id}/spend`, { amount: 0 });
    assert.equal(bad.status, 422);
    const viewer = await call('POST', `/campaigns/${running.id}/spend`, { amount: 10 }, 'viewer');
    assert.equal(viewer.status, 403);
  });

  it('starts early, completes early and cancels with a reason, in that order only', async () => {
    const c = await create(20, 60);
    const done = await call('POST', `/campaigns/${c.id}/status`, { status: 'Completed' });
    assert.equal(done.status, 409);

    const started = await call('POST', `/campaigns/${c.id}/status`, { status: 'Active' });
    assert.equal(started.body.status, 'Active');
    assert.ok(Date.parse(started.body.startDate) <= Date.now(), 'starting early moves the start to now');
    assert.equal(started.body.history.at(-1).text, 'Started early');

    const completed = await call('POST', `/campaigns/${c.id}/status`, { status: 'Completed' });
    assert.equal(completed.body.status, 'Completed');
    assert.ok(Date.parse(completed.body.endDate) <= Date.now() + 1000);

    const cancelLate = await call('POST', `/campaigns/${c.id}/status`, { status: 'Cancelled' });
    assert.equal(cancelLate.status, 409);
    assert.equal(cancelLate.body.error.code, 'finished');

    const other = await create(-2, 30);
    const cancelled = await call('POST', `/campaigns/${other.id}/status`, { status: 'Cancelled', reason: 'Budget moved to Q4' });
    assert.equal(cancelled.body.status, 'Cancelled');
    assert.equal(cancelled.body.cancelReason, 'Budget moved to Q4');
    assert.equal(cancelled.body.history.at(-1).text, 'Cancelled: Budget moved to Q4');
  });

  it('moves campaigns along by their dates on refresh', async () => {
    const soon = await create(1, 20);
    const ending = await create(-10, 2);
    refreshCampaigns(Date.now() + 3 * DAY);
    assert.equal(store.campaigns.get(soon.id)!.status, 'Active');
    assert.equal(store.campaigns.get(soon.id)!.history!.at(-1)!.by, 'System');
    assert.equal(store.campaigns.get(ending.id)!.status, 'Completed');
    const res = await call('POST', '/campaigns/refresh');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.changed));
  });
});

describe('campaign seed', () => {
  it('has a running, finished, cancelled and planned campaign, with spend that adds up and real returns', () => {
    const data = buildSeedData();
    assert.equal(data.campaigns.length, 8);
    const statuses = new Set(data.campaigns.map((c) => c.status));
    for (const s of ['Active', 'Completed', 'Cancelled', 'Planned']) assert.ok(statuses.has(s as never), s);
    for (const c of data.campaigns) {
      assert.equal((c.spendLog ?? []).reduce((t, s) => t + s.amount, 0), c.spent, c.name);
      assert.ok((c.spendLog ?? []).every((s) => s.amount > 0), c.name);
      assert.ok(c.budget > 0 && Date.parse(c.endDate) > Date.parse(c.startDate), c.name);
      if (c.status === 'Planned') assert.equal(data.leads.filter((l) => l.campaignId === c.id).length, 0);
    }
    const won = (id: string) => data.deals.filter((d) => d.campaignId === id && d.stage === 'Closed Won').reduce((t, d) => t + d.amount, 0);
    const returns = data.campaigns.filter((c) => c.spent).map((c) => won(c.id) / c.spent!).filter((x) => x > 0);
    assert.ok(Math.min(...returns) >= 0.5 && Math.max(...returns) <= 20, returns.join(', '));
  });
});
