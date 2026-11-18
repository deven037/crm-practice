import './setup.js';
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import express from 'express';
import { store } from '../src/db.js';
import { demoToken, useDemoBank } from './helpers.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { productsRouter } from '../src/routes/products.js';
import { quotesRouter, quoteSettingsRouter } from '../src/routes/quotes.js';
import { quoteSums } from '../src/quoteMath.js';
import { Role } from '../src/types.js';
import { buildSeedData } from '../src/seed.js';

let server: Server;
let base = '';
const made = { products: [] as string[], quotes: [] as string[], deals: [] as string[] };

before(async () => {
  await useDemoBank();
  const app = express();
  app.use(express.json());
  app.use('/api/products', productsRouter);
  app.use('/api/quotes', quotesRouter);
  app.use('/api/quoteSettings', quoteSettingsRouter);
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
  made.products.forEach((id) => store.products.remove(id));
  made.quotes.forEach((id) => store.quotes.remove(id));
  made.deals.forEach((id) => store.deals.remove(id));
  store.quoteSettings.remove('quote-settings');
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

const line = (productId: string, discountPct: number) => {
  const p = store.products.get(productId)!;
  return { productId, productName: p.name, quantity: 2, unitPrice: p.price, discountPct };
};

describe('products 3.0', () => {
  it('starts a price history, keeps the SKU and adds a point only when the price changes', async () => {
    const created = await call('POST', '/products', { name: 'Trade Desk Retainer', sku: 'TRD-DESK', category: 'Trade', price: 9000, unit: 'Monthly' });
    assert.equal(created.status, 201);
    made.products.push(created.body.id);
    assert.equal(created.body.unit, 'Monthly');
    assert.equal(created.body.priceHistory.length, 1);
    assert.equal(created.body.priceHistory[0].by, 'Riya Rep');

    const same = await call('PUT', `/products/${created.body.id}`, { name: 'Trade Desk Retainer', sku: 'CHANGED', category: 'Trade', price: 9000 });
    assert.equal(same.body.priceHistory.length, 1);
    assert.equal(same.body.sku, 'TRD-DESK');
    assert.equal(same.body.unit, 'Monthly', 'a save without a charge type keeps the saved one');

    const dearer = await call('PUT', `/products/${created.body.id}`, { name: 'Trade Desk Retainer', category: 'Trade', price: 9900, unit: 'Monthly' });
    assert.deepEqual(dearer.body.priceHistory.map((p: { price: number }) => p.price), [9000, 9900]);
  });
});

describe('quotes 3.0', () => {
  it('blocks sending a discount above the limit until the approver says yes', async () => {
    const draft = await call('POST', '/quotes', { accountId: 'account-1', lineItems: [line('product-3', 20), line('product-6', 0)] });
    assert.equal(draft.status, 201);
    made.quotes.push(draft.body.id);
    assert.equal(draft.body.ownerId, 'user-2');
    assert.equal(draft.body.lineItems[0].unit, 'Yearly', 'the line copies the charge type');
    assert.equal(draft.body.lineItems[0].sku, 'CRD-CORP');
    assert.equal(draft.body.approval, null);

    const early = await call('POST', `/quotes/${draft.body.id}/transition`, { status: 'Sent' });
    assert.equal(early.status, 409);
    assert.equal(early.body.error.code, 'approval_needed');

    const asked = await call('POST', `/quotes/${draft.body.id}/approval`, { decision: 'ask' });
    assert.equal(asked.body.approval, 'waiting');
    const byRep = await call('POST', `/quotes/${draft.body.id}/approval`, { decision: 'approve' });
    assert.equal(byRep.status, 403, 'with no approver named, only an admin decides');
    const approved = await call('POST', `/quotes/${draft.body.id}/approval`, { decision: 'approve', note: 'Strategic account' }, 'admin');
    assert.equal(approved.body.approval, 'approved');
    assert.equal(approved.body.approvedBy, 'Alex Admin');

    // A new discount removes the approval again.
    const changed = await call('PUT', `/quotes/${draft.body.id}`, { accountId: 'account-1', status: 'Sent', lineItems: [line('product-3', 25), line('product-6', 0)] });
    assert.equal(changed.status, 200);
    assert.equal(changed.body.status, 'Draft', 'PUT never moves the status');
    assert.equal(changed.body.approval, null);
    assert.ok(changed.body.history.some((e: { text: string }) => e.text.includes('approval was removed')));

    await call('POST', `/quotes/${draft.body.id}/approval`, { decision: 'ask' });
    await call('POST', `/quotes/${draft.body.id}/approval`, { decision: 'approve' }, 'admin');
    const sent = await call('POST', `/quotes/${draft.body.id}/transition`, { status: 'Sent' });
    assert.equal(sent.status, 200);
    assert.equal(sent.body.quote.status, 'Sent');
    assert.ok(sent.body.quote.sentAt);
    assert.deepEqual(
      sent.body.quote.history.map((e: { text: string }) => e.text.split(' ')[0]),
      ['Created', 'Approval', 'Alex', 'Lines', 'Discounts', 'Approval', 'Alex', 'Sent'],
    );
  });

  it('needs a reason to reject, and revising clears the answer with a new validity date', async () => {
    const q = await call('POST', '/quotes', { accountId: 'account-2', lineItems: [line('product-5', 5)] });
    made.quotes.push(q.body.id);
    await call('POST', `/quotes/${q.body.id}/transition`, { status: 'Sent' });
    const noReason = await call('POST', `/quotes/${q.body.id}/transition`, { status: 'Rejected' });
    assert.equal(noReason.status, 409);
    const rejected = await call('POST', `/quotes/${q.body.id}/transition`, { status: 'Rejected', reason: 'Price too high', note: 'wants 10%' });
    assert.equal(rejected.body.quote.rejectReason, 'Price too high');
    assert.ok(rejected.body.quote.decidedAt);
    const revised = await call('POST', `/quotes/${q.body.id}/transition`, { status: 'Draft' });
    assert.equal(revised.body.quote.status, 'Draft');
    assert.equal(revised.body.quote.rejectReason, null);
    assert.equal(revised.body.quote.sentAt, null);
    assert.ok(new Date(revised.body.quote.validUntil).getTime() > Date.now() + 29 * 86_400_000);
  });

  it('closes the linked deal when the quote is accepted, then locks the quote', async () => {
    const deal = { id: 'deal-quote-contract', name: 'Cards for staff', accountId: 'account-3', stage: 'Proposal', amount: 400000, probability: 60, ownerId: 'user-2', closeDate: '2026-12-31T00:00:00.000Z', createdAt: new Date().toISOString(), stageHistory: [] };
    store.deals.create(deal as any);
    made.deals.push(deal.id);
    const q = await call('POST', '/quotes', { accountId: 'account-3', dealId: deal.id, lineItems: [line('product-3', 10)] });
    made.quotes.push(q.body.id);
    await call('POST', `/quotes/${q.body.id}/transition`, { status: 'Sent' });
    const accepted = await call('POST', `/quotes/${q.body.id}/transition`, { status: 'Accepted' });
    assert.equal(accepted.body.deal.stage, 'Closed Won');
    assert.equal(accepted.body.deal.stageHistory.at(-1).note, `Quote ${q.body.quoteNumber} accepted`);
    const edit = await call('PUT', `/quotes/${q.body.id}`, { accountId: 'account-3', lineItems: [line('product-3', 0)] });
    assert.equal(edit.status, 409);
    assert.equal(edit.body.error.code, 'quote_locked');
  });

  it('keeps quote settings with defaults, saved by admins only, and the limit drives the rule', async () => {
    const defaults = await call('GET', '/quoteSettings');
    assert.deepEqual({ ...defaults.body, id: undefined }, { id: undefined, taxName: 'GST', taxPercent: 18, validityDays: 30, discountLimit: 15, approverId: null });
    const settings = { taxName: 'GST', taxPercent: 18, validityDays: 45, discountLimit: 30, approverId: 'user-4' };
    assert.equal((await call('PUT', '/quoteSettings', settings)).status, 403);
    assert.equal((await call('PUT', '/quoteSettings', { ...settings, approverId: 'nobody' }, 'admin')).status, 409);
    const saved = await call('PUT', '/quoteSettings', settings, 'admin');
    assert.equal(saved.body.discountLimit, 30);

    const q = await call('POST', '/quotes', { accountId: 'account-4', lineItems: [line('product-5', 25)] });
    made.quotes.push(q.body.id);
    assert.ok(new Date(q.body.validUntil).getTime() > Date.now() + 44 * 86_400_000, 'validity comes from the settings');
    const sent = await call('POST', `/quotes/${q.body.id}/transition`, { status: 'Sent' });
    assert.equal(sent.status, 200, '25% is within a 30% limit');
    store.quoteSettings.remove('quote-settings');
  });
});

describe('quote sums and seed', () => {
  it('counts monthly charges 12 times and adds tax in the first-year value', () => {
    const s = quoteSums([
      { id: 'a', productId: 'x', productName: 'x', quantity: 2, unitPrice: 1000, discountPct: 10, unit: 'Monthly' },
      { id: 'b', productId: 'y', productName: 'y', quantity: 1, unitPrice: 5000, discountPct: 0 },
    ], 18);
    assert.equal(s.gross, 7000);
    assert.equal(s.discount, 200);
    assert.equal(Math.round(s.tax), 1224);
    assert.equal(Math.round(s.firstYear), Math.round((5000 + 12 * 1800) * 1.18));
  });

  it('seeds banking products with prices over time and quotes with their dates and history', () => {
    const data = buildSeedData();
    assert.equal(data.products.length, 12);
    assert.ok(data.products.every((p) => p.unit && p.priceHistory?.length && p.priceHistory.at(-1)!.price === p.price));
    assert.ok(data.statusCodeSets.some((s) => s.module === 'products' && s.field === 'category'));
    assert.ok(data.statusCodeSets.some((s) => s.module === 'quotes' && s.field === 'rejectReason'));
    for (const q of data.quotes) {
      assert.ok(q.history?.length && q.ownerId);
      if (q.status !== 'Draft') assert.ok(q.sentAt, `${q.quoteNumber} has a sent date`);
      if (['Accepted', 'Rejected', 'Expired'].includes(q.status)) assert.ok(q.decidedAt);
      if (q.status === 'Rejected') assert.ok(q.rejectReason);
      if (q.status !== 'Draft' && q.lineItems.some((l) => l.discountPct > 15)) assert.equal(q.approval, 'approved');
    }
  });
});
