import './setup.js';
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import express from 'express';
import { store } from '../src/db.js';
import { demoToken, useDemoBank } from './helpers.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { BANK_LAYOUT_ID, dashboardRouter, userLayoutId } from '../src/routes/dashboard.js';
import { Role } from '../src/types.js';

let server: Server;
let base = '';

before(async () => {
  await useDemoBank();
  const app = express();
  app.use(express.json());
  app.use('/api/dashboard', dashboardRouter);
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
  for (const id of [BANK_LAYOUT_ID, userLayoutId('user-1'), userLayoutId('user-2'), userLayoutId('user-3')]) store.dashboardLayouts.remove(id);
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

const cards = [
  { id: 'needs', span: 5, rows: null, hidden: false },
  { id: 'month', span: 7, rows: 9, hidden: false },
  { id: 'team', span: 8, rows: null, hidden: true },
];

describe('dashboard layouts', () => {
  it('starts with nothing saved, so the page uses its built-in layout', async () => {
    const res = await call('GET', '/dashboard/layout');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { mine: null, bank: null });
  });

  it('keeps one layout per person, viewers included, and drops it on reset', async () => {
    const saved = await call('PUT', '/dashboard/layout', { cards });
    assert.equal(saved.status, 200);
    assert.equal(saved.body.id, 'user-user-2');
    assert.deepEqual(saved.body.cards, cards);

    const viewer = await call('PUT', '/dashboard/layout', { cards: cards.slice(0, 1) }, 'viewer');
    assert.equal(viewer.status, 200);
    assert.equal((await call('GET', '/dashboard/layout', undefined, 'viewer')).body.mine.cards.length, 1);
    assert.equal((await call('GET', '/dashboard/layout')).body.mine.cards.length, 3, 'one person’s layout never changes another’s');

    assert.equal((await call('DELETE', '/dashboard/layout')).status, 204);
    assert.equal((await call('GET', '/dashboard/layout')).body.mine, null);
  });

  it('lets only admins set the bank layout, which everyone then reads', async () => {
    assert.equal((await call('PUT', '/dashboard/layout/bank', { cards })).status, 403);
    const set = await call('PUT', '/dashboard/layout/bank', { cards }, 'admin');
    assert.equal(set.status, 200);
    assert.equal(set.body.userId, null);
    assert.equal((await call('GET', '/dashboard/layout')).body.bank.cards[1].rows, 9);
  });

  it('refuses sizes outside the grid and cards listed twice', async () => {
    assert.equal((await call('PUT', '/dashboard/layout', { cards: [{ id: 'x', span: 13, rows: null, hidden: false }] })).status, 422);
    assert.equal((await call('PUT', '/dashboard/layout', { cards: [{ id: 'x', span: 4, rows: 0, hidden: false }] })).status, 422);
    assert.equal((await call('PUT', '/dashboard/layout', { cards: [cards[0], cards[0]] })).status, 422);
  });
});
