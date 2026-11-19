import './setup.js';
import { after, before, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createApp } from '../src/app.js';
import { demoToken, useDemoBank } from './helpers.js';
import type { Role } from '../src/types.js';
import { DEMO_BANK_ID } from '../src/banks.js';
import { forgetBankStore } from '../src/tenancy.js';

let server: Server;
let base: string;

before(async () => {
  await useDemoBank();
  server = await new Promise<Server>(resolve => {
    const listener = createApp().listen(0, () => resolve(listener));
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
});
after(() => server.close());

async function call(method: string, path: string, body?: unknown, role: Role = 'admin') {
  const response = await fetch(base + path, {
    method, headers: { Authorization: `Bearer ${demoToken(role)}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: response.status === 204 ? undefined : await response.json() };
}

it('keeps drafts private, rejects stale saves, publishes and restores a historical snapshot across reloads', async () => {
  assert.equal((await call('GET', '/setup/draft', undefined, 'rep')).status, 403);
  const initial = (await call('GET', '/setup/draft')).body;
  const settings = structuredClone(initial.settings);
  settings.statusCodeSets[0].options.push('Under review');
  const id = settings.statusCodeSets[0].id;
  const payload = { revision: initial.revision, settings };
  const saved = await call('PUT', '/setup/draft', payload);
  assert.equal(saved.status, 200);
  assert.equal((await call('PUT', '/setup/draft', payload)).status, 409);
  const visible = () => call('GET', '/statusCodeSets/' + id, undefined, 'viewer');
  assert.deepEqual((await visible()).body.options, initial.settings.statusCodeSets[0].options);
  forgetBankStore(DEMO_BANK_ID);
  const publish = { revision: saved.body.revision, note: 'Add review option' };
  assert.equal((await call('POST', '/setup/publish', publish)).status, 201);
  assert.equal((await call('POST', '/setup/publish', publish)).status, 409);
  forgetBankStore(DEMO_BANK_ID);
  assert.deepEqual((await visible()).body.options, settings.statusCodeSets[0].options);
  const history = (await call('GET', '/setup/versions')).body;
  assert.deepEqual(history.map((v: { number: number }) => v.number), [1, 0]);
  const current = (await call('GET', '/setup/draft')).body;
  const rollback = await call('POST', '/setup/versions/0/restore', { revision: current.revision });
  assert.equal(rollback.status, 200);
  assert.deepEqual((await visible()).body.options, settings.statusCodeSets[0].options);
  assert.equal((await call('POST', '/setup/publish', { revision: rollback.body.revision, note: 'Restore original' })).status, 201);
  assert.deepEqual((await visible()).body.options, initial.settings.statusCodeSets[0].options);
});

it('protects live edits made through the legacy API while a draft is open', async () => {
  const current = (await call('GET', '/setup/draft')).body;
  const row = current.settings.statusCodeSets[0];
  const invalid = { statusCodeSets: [row, row] };
  assert.equal((await call('PUT', '/setup/draft', { revision: current.revision, settings: invalid })).status, 422);
  const saved = await call('PUT', '/setup/draft', { revision: current.revision, settings: current.settings });
  assert.equal((await call('PUT', '/statusCodeSets/' + row.id, { ...row, name: 'Renamed' })).status, 200);
  const revision = saved.body.revision;
  assert.equal((await call('POST', '/setup/publish', { revision, note: 'Stale draft' })).status, 409);
  assert.equal((await call('DELETE', '/setup/draft', { revision })).status, 204);
  assert.equal((await call('GET', '/setup/draft')).body.dirty, false);
});
