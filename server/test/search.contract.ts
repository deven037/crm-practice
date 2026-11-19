import './setup.js';
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { store } from '../src/db.js';
import { env } from '../src/env.js';
import { simulatedLatency } from '../src/middleware/latency.js';
import { demoToken, useDemoBank } from './helpers.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { apiRouter } from '../src/routes/index.js';
import { parseQuery, RECENT_SEARCH_LIMIT, runSearch, ticketRef } from '../src/routes/search.js';
import { Role } from '../src/types.js';

let server: Server;
let base = '';

const REP = { id: 'user-2', role: 'rep' as Role };
const VIEWER = { id: 'user-3', role: 'viewer' as Role };

async function call(method: string, path: string, role: Role | null, body?: unknown) {
  const res = await fetch(`${base}/api/search${path}`, {
    method,
    headers: { ...(role ? { Authorization: `Bearer ${demoToken(role)}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: res.status === 204 ? null : await res.json() };
}
const search = (query: string, role: Role | null) => call('GET', query, role);

const now = () => new Date().toISOString();
const lead = (id: string, over: Record<string, unknown>) => ({
  id, name: 'Zq Person', company: 'Zq Co', email: `${id}@zq.test`, phone: '', status: 'New' as const, source: 'Web',
  ownerId: 'user-1', value: 0, createdAt: now(), ...over,
});

before(async () => {
  await useDemoBank();
  const app = express();
  app.use(express.json());
  app.use(simulatedLatency);
  app.use('/api', apiRouter);
  app.use(errorHandler);
  server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  store.leads.create(lead('lead-zq-1', { name: 'Zqalpha One', phone: '(555) 010-4242' }));
  store.leads.create(lead('lead-zq-conv', { name: 'Zqalpha Converted', status: 'Converted' }));
  for (let i = 2; i <= 6; i++) store.leads.create(lead(`lead-zq-${i}`, { name: `Zqbulk ${i}`, ownerId: i % 2 ? 'user-2' : 'user-4' }));
  store.accounts.create({
    id: 'account-zq', name: 'Zqkapoor Exports', industry: 'Trade', employees: 10, revenue: 1, website: '', phone: '', ownerId: 'user-2',
    createdAt: now(), customFields: { zq_gstin: '27AAKPK4471M1Z2' },
  });
  store.customFieldDefs.create({ id: 'cf-zq-gstin', module: 'accounts', key: 'zq_gstin', label: 'GSTIN', type: 'text', required: false, createdAt: now() });
  store.contacts.create({
    id: 'contact-zq', name: 'Vikram Zqmenon', email: 'vikram@zqmenon.test', phone: '+91 98201 50211', accountId: 'account-zq', title: 'Director',
    tags: [], avatar: null, notes: [], files: [], createdAt: now(),
  });
  store.deals.create({
    id: 'deal-zq-1', name: 'Zqdeal Renewal', accountId: 'account-zq', amount: 1, stage: 'Proposal', closeDate: now(), probability: 10,
    ownerId: 'user-1', createdAt: now(),
  });
  store.tickets.create({
    id: 'ticket-9871', subject: 'Zqcard blocked abroad', description: 'Stuck at the airport', requester: 'Vikram Zqmenon', priority: 'Urgent',
    status: 'Open', slaDue: now(), createdAt: now(), comments: [], attachments: [], ownerId: 'user-2', category: 'Cards',
  });
});

after(() => {
  server.close();
});

describe('parseQuery', () => {
  it('takes type:, owner: and status: out of the words, quoted values included', () => {
    const { filters, text } = parseQuery('Kapoor type:Tickets owner:me status:"in progress" exports');
    assert.deepEqual(filters, { type: ['tickets'], owner: ['me'], status: ['in progress'] });
    assert.equal(text, 'kapoor exports');
  });
});

describe('GET /api/search', () => {
  it('does not incur simulated GET latency with latency simulation enabled', async (t) => {
    const disabled = env.disableLatency;
    env.disableLatency = false;
    const random = t.mock.method(Math, 'random', () => 1);
    try {
      for (const path of ['/api/search?q=zq', '/api/search/?q=zq', '/api/search/recent']) {
        const started = performance.now();
        const res = await fetch(`${base}${path}`, { headers: { Authorization: `Bearer ${demoToken('rep')}` } });
        await res.json();
        assert.equal(res.status, 200);
        assert.ok(performance.now() - started < 1000, 'Search must bypass the 1200 ms simulated delay');
      }
    } finally {
      random.mock.restore();
      env.disableLatency = disabled;
    }
  });

  it('rejects a missing token', async () => {
    assert.equal((await search('?q=zq', null)).status, 401);
  });

  it('rejects a missing or too-short term with a validation error', async () => {
    for (const query of ['', '?q=', '?q=z', '?q=%20z%20']) {
      const { status, body } = await search(query, 'admin');
      assert.equal(status, 422, query);
      assert.equal(body.error.code, 'validation_error');
    }
  });

  it('rejects a page size outside 1–60', async () => {
    assert.equal((await search('?q=zq&pageSize=0', 'admin')).status, 422);
    assert.equal((await search('?q=zq&pageSize=61', 'admin')).status, 422);
  });

  it('counts matches by type, owner and status, and pages the list', async () => {
    const { status, body } = await search('?q=zqbulk&pageSize=2&page=2', 'rep');
    assert.equal(status, 200);
    assert.equal(body.total, 5);
    assert.deepEqual(body.counts, { lead: 5 });
    assert.equal(body.items.length, 2);
    assert.equal(body.page, 2);
    assert.equal(body.totalPages, 3);
    assert.deepEqual(body.owners.map((o: { id: string; count: number }) => [o.id, o.count]), [['user-4', 3], ['user-2', 2]]);
    assert.deepEqual(body.statuses, [{ name: 'New', count: 5 }]);
  });

  it('facet picks narrow the list but not the counts', async () => {
    const { body } = await search('?q=zqbulk&owners=user-2', 'rep');
    assert.equal(body.total, 5);
    assert.equal(body.shown, 2);
    assert.ok(body.items.every((h: { ownerId: string }) => h.ownerId === 'user-2'));
  });

  it('hides converted leads', async () => {
    const { body } = await search('?q=zqalpha', 'rep');
    assert.deepEqual(body.items.map((h: { id: string }) => h.id), ['lead-zq-1']);
  });

  it('finds records in every module by name, and ranks a name above details', async () => {
    const { body } = await search('?q=zqkapoor', 'rep');
    assert.equal(body.items[0].id, 'account-zq');
    assert.equal(body.items[0].matchedIn, 'Name');
    // The deal and the contact name the account in their details.
    const types = body.items.map((h: { type: string }) => h.type).sort();
    assert.deepEqual(types, ['account', 'contact', 'deal']);
    const deal = body.items.find((h: { type: string }) => h.type === 'deal');
    assert.equal(deal.matchedIn, 'Details');
  });

  it('jumps straight to a ticket by its reference', async () => {
    const ref = ticketRef('ticket-9871');
    assert.equal(ref, 'TK-9871');
    const { body } = await search(`?q=${ref.toLowerCase()}`, 'rep');
    assert.equal(body.jump?.id, 'ticket-9871');
    assert.equal(body.jump?.matchedIn, 'Reference');
  });

  it('matches custom fields by value or by label and value, and says where', async () => {
    for (const term of ['27AAKPK4471', 'GSTIN 27aakpk']) {
      const { body } = await search(`?q=${encodeURIComponent(term)}`, 'viewer');
      const hit = body.items.find((h: { id: string }) => h.id === 'account-zq');
      assert.ok(hit, term);
      assert.equal(hit.matchedIn, 'GSTIN');
      assert.equal(hit.matchedValue, '27AAKPK4471M1Z2');
    }
  });

  it('filters by type, owner (me) and status typed in the box', async () => {
    const { body } = await search(`?q=${encodeURIComponent('type:ticket owner:me status:open')}`, 'rep');
    assert.deepEqual(body.filters, { type: ['ticket'], owner: ['me'], status: ['open'] });
    assert.ok(body.items.some((h: { id: string }) => h.id === 'ticket-9871'));
    assert.ok(body.items.every((h: { type: string; ownerId: string }) => h.type === 'ticket' && h.ownerId === 'user-2'));
    const admins = await search(`?q=${encodeURIComponent('type:ticket owner:me zqcard')}`, 'admin');
    assert.equal(admins.body.total, 0);
  });

  for (const role of ['admin', 'rep', 'viewer'] as const) {
    it(`as ${role}: ${role === 'viewer' ? 'neither returns nor matches' : 'returns and matches'} email and phone`, async () => {
      for (const term of ['5550104242', '555 010-4242', '(555)010 4242', 'lead-zq-1@zq.test']) {
        const { body } = await search(`?q=${encodeURIComponent(term)}`, role);
        assert.equal(body.items.some((h: { id: string }) => h.id === 'lead-zq-1'), role !== 'viewer', term);
      }
      const { body } = await search('?q=zqalpha', role);
      const labels = body.items[0].fields.map(([label]: [string, string]) => label);
      assert.equal(labels.includes('Email'), role !== 'viewer');
    });
  }
});

describe('runSearch', () => {
  it('puts the person’s own records first when everything else ties', () => {
    const result = runSearch('zqbulk', REP);
    assert.equal(result.items[0].ownerId, 'user-2');
  });

  it('does not match email for viewers', () => {
    assert.equal(runSearch('vikram@zqmenon.test', VIEWER).total, 0);
    assert.equal(runSearch('vikram@zqmenon.test', REP).items[0].matchedIn, 'Email');
  });
});

describe('recent searches', () => {
  it('keeps each person’s own list, newest first, without repeats, capped', async () => {
    assert.equal((await call('DELETE', '/recent', 'rep')).status, 204);
    await call('POST', '/recent', 'rep', { term: 'kapoor' });
    await call('POST', '/recent', 'rep', { term: 'TK-0010' });
    const again = await call('POST', '/recent', 'rep', { term: 'Kapoor' });
    assert.deepEqual(again.body.terms, ['Kapoor', 'TK-0010']);
    assert.deepEqual((await call('GET', '/recent', 'viewer')).body.terms, []);
    for (let i = 0; i < RECENT_SEARCH_LIMIT + 3; i++) await call('POST', '/recent', 'rep', { term: `term ${i}` });
    assert.equal((await call('GET', '/recent', 'rep')).body.terms.length, RECENT_SEARCH_LIMIT);
    assert.equal((await call('POST', '/recent', 'rep', { term: 'x' })).status, 422);
  });
});
