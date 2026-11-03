import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { store } from '../src/db.js';
import { signToken } from '../src/middleware/auth.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { apiRouter } from '../src/routes/index.js';
import { runSearch } from '../src/routes/search.js';
import { Role } from '../src/types.js';

let server: Server;
let base = '';

const tokenFor = (role: Role) => signToken({ id: `u-${role}`, name: role, email: `${role}@crm.com`, role });

async function search(query: string, role: Role | null) {
  const res = await fetch(`${base}/api/search${query}`, {
    headers: role ? { Authorization: `Bearer ${tokenFor(role)}` } : {},
  });
  return { status: res.status, body: await res.json() };
}

const lead = (id: string, over: Record<string, unknown>) => ({
  id,
  name: 'Zq Person',
  company: 'Zq Co',
  email: `${id}@zq.test`,
  phone: '',
  status: 'New' as const,
  source: 'Web',
  ownerId: 'user-1',
  value: 0,
  createdAt: new Date().toISOString(),
  ...over,
});

before(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api', apiRouter);
  app.use(errorHandler);
  server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  store.leads.create(lead('lead-zq-1', { name: 'Zqalpha One', phone: '(555) 010-4242' }));
  store.leads.create(lead('lead-zq-conv', { name: 'Zqalpha Converted', status: 'Converted' }));
  for (let i = 2; i <= 6; i++) store.leads.create(lead(`lead-zq-${i}`, { name: `Zqbulk ${i}` }));
  store.deals.create({
    id: 'deal-zq-1',
    name: 'Zqdeal Renewal',
    accountId: null,
    amount: 1,
    stage: 'Proposal',
    closeDate: new Date().toISOString(),
    probability: 10,
    ownerId: 'user-1',
    createdAt: new Date().toISOString(),
  });
});

after(() => {
  server.close();
});

describe('GET /api/search', () => {
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

  it('rejects a limit outside 1–10', async () => {
    assert.equal((await search('?q=zq&limit=0', 'admin')).status, 422);
    assert.equal((await search('?q=zq&limit=11', 'admin')).status, 422);
  });

  for (const role of ['admin', 'rep', 'viewer'] as const) {
    describe(`as ${role}`, () => {
      it('groups results, caps each group at 3 and reports the full total', async () => {
        const { status, body } = await search('?q=zqbulk', role);
        assert.equal(status, 200);
        assert.equal(body.leads.items.length, 3);
        assert.equal(body.leads.total, 5);
        assert.deepEqual(Object.keys(body).sort(), ['accounts', 'contacts', 'deals', 'leads', 'term']);
      });

      it('hides converted leads from items and totals', async () => {
        const { body } = await search('?q=zqalpha', role);
        assert.deepEqual(body.leads.items.map((l: { id: string }) => l.id), ['lead-zq-1']);
        assert.equal(body.leads.total, 1);
      });

      it(role === 'viewer' ? 'neither returns nor matches email and phone' : 'finds a phone typed with spaces, dashes and brackets', async () => {
        for (const term of ['5550104242', '555 010-4242', '(555)010 4242']) {
          const { body } = await search(`?q=${encodeURIComponent(term)}`, role);
          const found = body.leads.items.some((l: { id: string }) => l.id === 'lead-zq-1');
          assert.equal(found, role !== 'viewer', term);
        }
        const byEmail = await search('?q=lead-zq-1@zq.test', role);
        assert.equal(byEmail.body.leads.total, role === 'viewer' ? 0 : 1);
        const byName = await search('?q=zqalpha', role);
        assert.equal('email' in byName.body.leads.items[0], role !== 'viewer');
        assert.equal('phone' in byName.body.leads.items[0], role !== 'viewer');
      });

      it('matches deals by name only', async () => {
        const { body } = await search('?q=zqdeal', role);
        assert.equal(body.deals.total, 1);
        assert.equal(body.deals.items[0].email, undefined);
      });
    });
  }
});

describe('runSearch without Email/Phone permission', () => {
  it('does not return or match email or phone, and totals exclude those matches', () => {
    const hiddenEmail = runSearch('lead-zq-1@zq.test', 3, false);
    assert.equal(hiddenEmail.leads.total, 0);
    const hiddenPhone = runSearch('5550104242', 3, false);
    assert.equal(hiddenPhone.leads.total, 0);

    const byName = runSearch('zqalpha', 3, false);
    assert.equal(byName.leads.total, 1);
    assert.equal(byName.leads.items[0].email, undefined);
    assert.equal(byName.leads.items[0].phone, undefined);
  });

  it('returns and matches email and phone with permission', () => {
    const result = runSearch('lead-zq-1@zq.test', 3, true);
    assert.equal(result.leads.total, 1);
    assert.equal(result.leads.items[0].phone, '(555) 010-4242');
  });
});
