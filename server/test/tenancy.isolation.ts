import './setup.js';
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createApp, prepare } from '../src/app.js';
import { COLLECTION_NAMES } from '../src/db.js';
import { DEMO_BANK_ID } from '../src/banks.js';
import { forgetBankStore, getBankStore } from '../src/tenancy.js';

process.env.DISABLE_LATENCY = 'true';

let server: Server;
let base = '';

// A 1x1 PNG.
const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

async function api(method: string, path: string, options: { token?: string; body?: unknown } = {}) {
  const res = await fetch(`${base}/api${path}`, {
    method,
    headers: {
      ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await res.text();
  let body: any = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    /* not JSON (an image) */
  }
  return { status: res.status, body, headers: res.headers };
}

function registration(name: string, domain: string, over: Record<string, unknown> = {}) {
  return {
    displayName: name,
    legalName: `${name} Limited`,
    bankType: 'commercial',
    registrationNumber: 'REG-12345',
    country: 'in',
    address: '1 Main Road, Mumbai',
    website: `https://www.${domain}`,
    contactName: 'Head of IT',
    contactPhone: '+91 22 5550 0100',
    contactEmail: `it@${domain}`,
    emailDomains: [domain],
    currency: 'inr',
    locale: 'en-IN',
    timezone: 'Asia/Kolkata',
    brandColor: '#97144d',
    branches: 12,
    expectedUsers: 80,
    sampleData: true,
    admin: { name: `${name} Admin`, email: `admin@${domain}`, password: 'Start-here-1' },
    logo: PNG,
    loginImage: PNG,
    ...over,
  };
}

let owner = '';
let axis: { id: string; token: string };
let hdfc: { id: string; token: string };

async function login(email: string, password = 'Start-here-1', extra: Record<string, unknown> = {}) {
  return api('POST', '/auth/login', { body: { email, password, ...extra } });
}

before(async () => {
  await prepare();
  const app = createApp();
  server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe('bank registration and approval', () => {
  it('rejects a registration that breaks the rules', async () => {
    const publicDomain = await api('POST', '/platform/banks', { body: registration('Gmail Bank', 'gmail.com') });
    assert.equal(publicDomain.status, 422);

    const adminElsewhere = await api('POST', '/platform/banks', {
      body: registration('Elsewhere Bank', 'elsewhere.test', {
        admin: { name: 'A', email: 'admin@other.test', password: 'Start-here-1' },
      }),
    });
    assert.equal(adminElsewhere.status, 422);

    const weakPassword = await api('POST', '/platform/banks', {
      body: registration('Weak Bank', 'weak.test', { admin: { name: 'A', email: 'admin@weak.test', password: 'short' } }),
    });
    assert.equal(weakPassword.status, 422);

    const notAnImage = await api('POST', '/platform/banks', {
      body: registration('Svg Bank', 'svg.test', { logo: 'data:image/svg+xml;base64,PHN2Zy8+' }),
    });
    assert.equal(notAnImage.status, 422);
    assert.equal(notAnImage.body.error.code, 'invalid_image');
  });

  it('saves a new bank as pending, and nobody can sign in to it yet', async () => {
    const created = await api('POST', '/platform/banks', { body: registration('Axis Bank', 'axisbank.test') });
    assert.equal(created.status, 201);
    assert.equal(created.body.status, 'pending');
    axis = { id: created.body.id, token: '' };

    const duplicate = await api('POST', '/platform/banks', { body: registration('axis bank', 'axis-two.test') });
    assert.equal(duplicate.status, 409);

    const blocked = await login('admin@axisbank.test');
    assert.equal(blocked.status, 403);
    assert.equal(blocked.body.error.code, 'bank_pending');

    // A wrong password learns nothing about the bank's state.
    const wrong = await login('admin@axisbank.test', 'Wrong-pass-1');
    assert.equal(wrong.status, 401);

    const status = await api('GET', '/platform/registration-status?email=admin@axisbank.test');
    assert.equal(status.body.status, 'pending');

    // Its images are not public while it is pending.
    assert.equal((await api('GET', `/public/banks/${axis.id}/assets/logo`)).status, 404);
    const identified = await api('POST', '/auth/identify', { body: { email: 'someone@axisbank.test' } });
    assert.deepEqual(identified.body.banks, [
      { id: axis.id, name: 'Axis Bank', status: 'pending', color: null, logoUrl: null, loginImageUrl: null },
    ]);
  });

  it('keeps the platform console for the platform owner only', async () => {
    assert.equal((await api('GET', '/platform/banks')).status, 401);
    const demo = await login('admin@crm.com', 'Pass@123');
    assert.equal(demo.status, 200);
    assert.equal((await api('GET', '/platform/banks', { token: demo.body.token })).status, 403);
    assert.equal((await api('POST', `/platform/banks/${axis.id}/approve`, { token: demo.body.token, body: {} })).status, 403);

    const bad = await api('POST', '/platform/login', { body: { email: 'owner@platform.test', password: 'nope' } });
    assert.equal(bad.status, 401);
    const good = await api('POST', '/platform/login', { body: { email: 'owner@platform.test', password: 'Owner-test-1' } });
    assert.equal(good.status, 200);
    owner = good.body.token;

    // The owner's token is not a bank user's token.
    assert.equal((await api('GET', '/leads', { token: owner })).status, 401);
  });

  it('lets the bank in once the owner approves it', async () => {
    const pending = await api('GET', '/platform/banks?status=pending', { token: owner });
    assert.deepEqual(pending.body.data.map((bank: any) => bank.displayName), ['Axis Bank']);
    assert.equal(pending.body.data[0].profile.country, 'IN');
    assert.equal(pending.body.data[0].users, 5);

    const approved = await api('POST', `/platform/banks/${axis.id}/approve`, { token: owner, body: {} });
    assert.equal(approved.status, 200);
    assert.equal(approved.body.status, 'active');

    const signedIn = await login('admin@axisbank.test');
    assert.equal(signedIn.status, 200);
    assert.equal(signedIn.body.bank.name, 'Axis Bank');
    assert.equal(signedIn.body.user.password, undefined);
    axis.token = signedIn.body.token;

    const identified = await api('POST', '/auth/identify', { body: { email: 'anyone@axisbank.test' } });
    const [bank] = identified.body.banks;
    assert.equal(bank.color, '#97144d');
    assert.match(bank.logoUrl, /\/api\/public\/banks\/.+\/assets\/logo\?v=\d+$/);
    const logo = await fetch(bank.logoUrl);
    assert.equal(logo.status, 200);
    assert.equal(logo.headers.get('content-type'), 'image/png');

    const boot = await api('GET', '/bootstrap', { token: axis.token });
    assert.equal(boot.body.bankProfile.name, 'Axis Bank');
    assert.equal(boot.body.bankProfile.currency, 'INR');
  });

  it('gives sample users no way to sign in, and an empty bank no business records', async () => {
    const sample = await login('sample.user2@axisbank.test', 'Pass@123');
    assert.equal(sample.status, 401);

    const created = await api('POST', '/platform/banks', { body: registration('HDFC Bank', 'hdfcbank.test', { sampleData: false }) });
    hdfc = { id: created.body.id, token: '' };
    await api('POST', `/platform/banks/${hdfc.id}/approve`, { token: owner, body: {} });
    hdfc.token = (await login('admin@hdfcbank.test')).body.token;

    const boot = await api('GET', '/bootstrap', { token: hdfc.token });
    assert.equal(boot.body.leads.length, 0);
    assert.equal(boot.body.accounts.length, 0);
    assert.equal(boot.body.users.length, 1);
    assert.ok(boot.body.roleDefs.length > 0, 'settings every bank needs are present');
    assert.ok(boot.body.statusCodeSets.length > 0);
  });
});

describe('one bank cannot reach another bank\'s data', () => {
  let leadId = '';

  it('keeps records created in one bank out of every other bank', async () => {
    const created = await api('POST', '/leads', {
      token: axis.token,
      body: { name: 'Zzyx Onlyaxis', company: 'Axis Customer', email: 'zzyx@customer.test', status: 'New', source: 'Web', ownerId: 'user-1', value: 500 },
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    leadId = created.body.id;

    for (const other of [hdfc.token, (await login('admin@crm.com', 'Pass@123')).body.token]) {
      assert.equal((await api('GET', `/leads/${leadId}`, { token: other })).status, 404);
      assert.equal((await api('PUT', `/leads/${leadId}`, { token: other, body: created.body })).status, 404);
      assert.equal((await api('DELETE', `/leads/${leadId}`, { token: other })).status, 404);
      const list = await api('GET', '/leads?q=Zzyx', { token: other });
      assert.equal(list.body.total, 0);
      const search = await api('GET', '/search?q=Zzyx', { token: other });
      // The response repeats the search term, so check the results themselves.
      assert.equal(search.body.leads.total, 0);
      assert.deepEqual(search.body.leads.items, []);
      const boot = await api('GET', '/bootstrap', { token: other });
      assert.ok(!JSON.stringify(boot.body).includes('Zzyx'));
    }
    assert.equal((await api('GET', `/leads/${leadId}`, { token: axis.token })).status, 200);
  });

  it('changes a record with the same id in one bank only', async () => {
    // Sample data gives Axis and the demo bank records with identical ids.
    const demoToken = (await login('admin@crm.com', 'Pass@123')).body.token;
    const [shared] = (await api('GET', '/leads?pageSize=1', { token: demoToken })).body.data;
    const before = (await api('GET', `/leads/${shared.id}`, { token: demoToken })).body;
    const axisCopy = (await api('GET', `/leads/${shared.id}`, { token: axis.token })).body;
    assert.equal(axisCopy.id, shared.id);

    const changed = await api('PUT', `/leads/${shared.id}`, { token: axis.token, body: { ...axisCopy, company: 'Changed By Axis' } });
    assert.equal(changed.status, 200, JSON.stringify(changed.body));
    assert.equal((await api('GET', `/leads/${shared.id}`, { token: demoToken })).body.company, before.company);

    assert.equal((await api('DELETE', `/leads/${shared.id}`, { token: axis.token })).status, 204);
    assert.equal((await api('GET', `/leads/${shared.id}`, { token: demoToken })).status, 200);
  });

  it('keeps users of one bank out of another, even with the same email', async () => {
    const users = await api('GET', '/users', { token: hdfc.token });
    assert.deepEqual(users.body.data.map((user: any) => user.email), ['admin@hdfcbank.test']);

    // An Axis password does not open HDFC, and naming another bank does not help.
    const wrongBank = await login('admin@axisbank.test', 'Start-here-1', { bankId: hdfc.id });
    assert.equal(wrongBank.status, 401);

    const noPassword = await api('POST', '/users', { token: hdfc.token, body: { name: 'New Rep', email: 'rep@hdfcbank.test', role: 'rep' } });
    assert.equal(noPassword.status, 422);
    const made = await api('POST', '/users', {
      token: hdfc.token,
      body: { name: 'New Rep', email: 'rep@hdfcbank.test', role: 'rep', password: 'Rep-pass-12' },
    });
    assert.equal(made.status, 201);
    assert.equal(made.body.password, undefined);
    assert.equal((await login('rep@hdfcbank.test', 'Rep-pass-12')).status, 200);
    assert.equal((await api('POST', '/users', { token: hdfc.token, body: { name: 'Twin', email: 'rep@hdfcbank.test', role: 'rep', password: 'Rep-pass-12' } })).status, 409);
  });

  it('holds every collection apart in the database, and keeps it across a restart', async () => {
    const axisStore = await getBankStore(axis.id);
    for (const name of COLLECTION_NAMES) {
      (axisStore.store[name] as any).create({ id: `marker-${name}`, name: 'marker', email: 'marker@axisbank.test', active: false });
    }
    await axisStore.flush();

    // Forget everything in memory: what comes back is only what the database holds.
    forgetBankStore();
    const [axisAgain, hdfcAgain, demoAgain] = await Promise.all([getBankStore(axis.id), getBankStore(hdfc.id), getBankStore(DEMO_BANK_ID)]);
    for (const name of COLLECTION_NAMES) {
      assert.ok((axisAgain.store[name] as any).get(`marker-${name}`), `${name}: saved for Axis`);
      assert.equal((hdfcAgain.store[name] as any).get(`marker-${name}`), undefined, `${name}: not in HDFC`);
      assert.equal((demoAgain.store[name] as any).get(`marker-${name}`), undefined, `${name}: not in the demo bank`);
    }
    assert.ok(axisAgain.store.leads.get(leadId), 'the lead created through the API was saved');
    assert.equal(axisAgain.store.leads.all()[0].id, 'marker-leads', 'newest record is still first after a reload');
    assert.equal((await api('GET', `/leads/${leadId}`, { token: axis.token })).status, 200);
  });

  it('stores passwords only as hashes', async () => {
    for (const id of [axis.id, hdfc.id, DEMO_BANK_ID]) {
      const users = (await getBankStore(id)).store.users.all().filter((user) => !user.id.startsWith('marker-'));
      for (const user of users) {
        assert.ok(user.password === '!' || /^\$2[aby]\$/.test(user.password), `${user.email} has a hashed password`);
      }
    }
  });
});

describe('suspending and removing a bank', () => {
  it('locks a suspended bank out at once, tokens included', async () => {
    assert.equal((await api('POST', `/platform/banks/${hdfc.id}/suspend`, { token: owner, body: {} })).status, 422);
    const suspended = await api('POST', `/platform/banks/${hdfc.id}/suspend`, { token: owner, body: { reason: 'Unpaid' } });
    assert.equal(suspended.body.status, 'suspended');

    const blocked = await api('GET', '/leads', { token: hdfc.token });
    assert.equal(blocked.status, 403);
    assert.equal(blocked.body.error.code, 'bank_suspended');
    assert.equal((await login('admin@hdfcbank.test')).status, 403);

    await api('POST', `/platform/banks/${hdfc.id}/reactivate`, { token: owner, body: {} });
    assert.equal((await api('GET', '/leads', { token: hdfc.token })).status, 200);
  });

  it('deletes a bank and all of its data, and never the demo bank', async () => {
    assert.equal((await api('DELETE', `/platform/banks/${DEMO_BANK_ID}`, { token: owner })).status, 409);
    assert.equal((await api('DELETE', `/platform/banks/${hdfc.id}`, { token: owner })).status, 204);
    assert.equal((await api('GET', '/leads', { token: hdfc.token })).status, 401);
    assert.equal((await login('admin@hdfcbank.test')).status, 401);
    assert.equal((await api('GET', '/leads', { token: axis.token })).status, 200);
  });

  it('only resets the demo bank through the open reset route', async () => {
    const before = (await api('GET', `/leads?pageSize=1`, { token: axis.token })).body.total;
    assert.equal((await api('POST', '/reset')).status, 200);
    assert.equal((await api('GET', `/leads?pageSize=1`, { token: axis.token })).body.total, before);
  });
});
