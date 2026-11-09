import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import express from 'express';
import { store } from '../src/db.js';
import { signToken } from '../src/middleware/auth.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { accountsRouter } from '../src/routes/accounts.js';

let server: Server;
let base = '';
const accountId = 'account-delete-regression';
const contactId = 'contact-delete-regression';
const dealIds = ['deal-delete-open', 'deal-delete-closed'];
const createdAt = '2026-11-09T00:00:00.000Z';

before(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/accounts', accountsRouter);
  app.use(errorHandler);
  server = await new Promise<Server>((resolve) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  base = `http://127.0.0.1:${address.port}`;

  store.accounts.create({
    id: accountId, name: 'Delete regression', industry: 'Technology',
    employees: 1, revenue: 0, website: '', phone: '', ownerId: 'user-1', createdAt,
  });
  store.contacts.create({
    id: contactId, name: 'Related contact', email: '', phone: '',
    accountId, title: '', tags: [], avatar: null, notes: [], files: [], createdAt,
  });
  store.deals.create({
    id: dealIds[0], name: 'Open deal', accountId, amount: 100,
    stage: 'Proposal', closeDate: createdAt, probability: 50, ownerId: 'user-1', createdAt,
  });
  store.deals.create({
    id: dealIds[1], name: 'Closed deal', accountId, amount: 200,
    stage: 'Closed Won', closeDate: createdAt, probability: 100, ownerId: 'user-1', createdAt,
  });
});

after(async () => {
  if (server) {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
  store.accounts.remove(accountId);
  store.contacts.remove(contactId);
  store.deals.removeMany(dealIds);
});

describe('DELETE /api/accounts/:id with open deals', () => {
  for (const cascade of [false, true]) {
    for (const role of ['admin', 'rep']) {
      it(`returns 409 without writes for cascade=${cascade} as ${role}`, async () => {
        const beforeDelete = structuredClone({
          accounts: store.accounts.all(), contacts: store.contacts.all(),
          deals: store.deals.all(), quotes: store.quotes.all(), audit: store.audit.all(),
        });
        const token = signToken({
          id: 'user-1', name: 'Delete test', email: 'delete@example.test',
          role: role === 'admin' ? 'admin' : 'rep',
        });
        const response = await fetch(`${base}/api/accounts/${accountId}?cascade=${cascade}`, {
          method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
        });
        assert.equal(response.status, 409);
        assert.deepEqual(await response.json(), {
          error: {
            code: 'open_deals',
            message: 'Account has 1 open deal(s). Close or reassign them first.',
          },
        });
        assert.deepEqual({
          accounts: store.accounts.all(), contacts: store.contacts.all(),
          deals: store.deals.all(), quotes: store.quotes.all(), audit: store.audit.all(),
        }, beforeDelete);
      });
    }
  }
});
