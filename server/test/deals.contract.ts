import './setup.js';
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import express from 'express';
import { store } from '../src/db.js';
import { demoToken, useDemoBank } from './helpers.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { dealsRouter, STAGE_HISTORY_LIMIT } from '../src/routes/deals.js';

let server: Server;
let base = '';
const dealId = 'deal-history-contract';

before(async () => {
  await useDemoBank();
  const app = express();
  app.use(express.json());
  app.use('/api/deals', dealsRouter);
  app.use(errorHandler);
  server = await new Promise<Server>((resolve) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  base = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (server) {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
  store.deals.remove(dealId);
});

const send = async (method: 'POST' | 'PUT', body: object) => {
  const response = await fetch(`${base}/api/deals${method === 'PUT' ? `/${dealId}` : ''}`, {
    method,
    headers: { Authorization: `Bearer ${demoToken('rep')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: response.status, deal: await response.json() };
};

const base_deal = { id: dealId, name: 'Escrow mandate', amount: 750000, probability: 30, ownerId: 'user-2', closeDate: '2026-12-20T00:00:00.000Z' };

describe('deal stages and stage history', () => {
  it('accepts a stage the bank added itself and starts the history on the server', async () => {
    const forged = [{ stage: 'Closed Won', at: '2020-01-01T00:00:00.000Z', by: 'Someone else' }];
    const { status, deal } = await send('POST', { ...base_deal, stage: 'Credit Review', stageHistory: forged, layoutName: 'Credit facility', nextStep: 'Collect GST returns' });
    assert.equal(status, 201);
    assert.equal(deal.stage, 'Credit Review');
    assert.equal(deal.layoutName, 'Credit facility');
    assert.equal(deal.nextStep, 'Collect GST returns');
    assert.equal(deal.stageHistory.length, 1);
    assert.deepEqual({ stage: deal.stageHistory[0].stage, by: deal.stageHistory[0].by }, { stage: 'Credit Review', by: 'Riya Rep' });
  });

  it('adds nothing when the stage stays the same, and keeps the layout it was created with', async () => {
    const { deal } = await send('PUT', { ...base_deal, stage: 'Credit Review', amount: 800000, layoutName: 'Standard deal' });
    assert.equal(deal.amount, 800000);
    assert.equal(deal.stageHistory.length, 1);
    assert.equal(deal.layoutName, 'Credit facility');
  });

  it('records a loss with its reason, then clears the reason when the deal is reopened', async () => {
    const lost = await send('PUT', { ...base_deal, stage: 'Closed Lost', probability: 0, lostReason: 'Chose another bank' });
    assert.equal(lost.deal.lostReason, 'Chose another bank');
    assert.deepEqual(lost.deal.stageHistory.map((e: { stage: string; note?: string }) => [e.stage, e.note]), [['Credit Review', undefined], ['Closed Lost', 'Chose another bank']]);

    const reopened = await send('PUT', { ...base_deal, stage: 'Negotiation', probability: 75, lostReason: 'Chose another bank' });
    assert.equal(reopened.deal.lostReason, '');
    assert.equal(reopened.deal.stageHistory.length, 3);
    assert.equal(reopened.deal.stageHistory[2].stage, 'Negotiation');
  });

  it(`keeps at most ${STAGE_HISTORY_LIMIT} entries`, async () => {
    for (let i = 0; i < STAGE_HISTORY_LIMIT + 2; i++) await send('PUT', { ...base_deal, stage: i % 2 ? 'Proposal' : 'Qualification' });
    const stored = store.deals.get(dealId);
    assert.equal(stored?.stageHistory?.length, STAGE_HISTORY_LIMIT);
  });

  it('starts the history of a deal saved before history existed from its old stage', async () => {
    const oldId = 'deal-history-before';
    store.deals.create({ id: oldId, name: 'Old deal', accountId: null, amount: 1, stage: 'Qualification', closeDate: '2026-12-01T00:00:00.000Z', probability: 20, ownerId: 'user-2', createdAt: '2026-10-01T00:00:00.000Z' });
    try {
      const response = await fetch(`${base}/api/deals/${oldId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${demoToken('rep')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Old deal', amount: 1, ownerId: 'user-2', stage: 'Proposal', probability: 50 }),
      });
      const deal = await response.json();
      assert.deepEqual(deal.stageHistory.map((e: { stage: string; at: string; by: string }) => [e.stage, e.by]), [['Qualification', ''], ['Proposal', 'Riya Rep']]);
      assert.equal(deal.stageHistory[0].at, '2026-10-01T00:00:00.000Z');
    } finally {
      store.deals.remove(oldId);
    }
  });

  it('rejects an empty stage', async () => {
    const { status } = await send('PUT', { ...base_deal, stage: '   ' });
    assert.equal(status, 422);
  });
});
