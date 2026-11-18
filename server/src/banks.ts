import { getDb } from './pg.js';
import { env } from './env.js';
import { buildSeedData } from './seed.js';
import { hashPassword, UNUSABLE_PASSWORD } from './passwords.js';
import { forgetBankStore, getBankStore } from './tenancy.js';
import { User } from './types.js';

export type BankStatus = 'pending' | 'active' | 'rejected' | 'suspended';
export const BANK_TYPES = ['commercial', 'cooperative', 'small_finance', 'nbfc', 'other'] as const;

/** Everything a bank tells us about itself at registration (and can edit later). */
export interface BankProfile {
  legalName: string;
  bankType: (typeof BANK_TYPES)[number];
  registrationNumber: string;
  country: string;
  address: string;
  website?: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  emailDomains: string[];
  currency: string;
  locale: string;
  timezone: string;
  brandColor: string;
  branches: number;
  expectedUsers: number;
  sampleData: boolean;
}

export interface Bank {
  id: string;
  displayName: string;
  status: BankStatus;
  statusReason: string | null;
  adminEmail: string;
  profile: BankProfile;
  createdAt: string;
  updatedAt: string;
  decidedAt: string | null;
  /** Kept banks survive the console's "Reset data" and cannot be deleted. The demo bank is always kept. */
  keep: boolean;
  /** Which images the bank has uploaded, with a version for cache busting. */
  assets: Partial<Record<AssetKind, string>>;
}

export type AssetKind = 'logo' | 'login';
export const ASSET_LIMITS: Record<AssetKind, number> = { logo: 1024 * 1024, login: 3 * 1024 * 1024 };

export const DEMO_BANK_ID = 'bank-demo';

/** Mail services anyone can sign up to: never accepted as a bank's own email domain. */
const PUBLIC_MAIL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.in', 'outlook.com', 'hotmail.com', 'live.com', 'msn.com',
  'icloud.com', 'me.com', 'aol.com', 'proton.me', 'protonmail.com', 'zoho.com', 'yandex.com', 'mail.com',
  'gmx.com', 'rediffmail.com',
]);

export function isPublicMailDomain(domain: string): boolean {
  return PUBLIC_MAIL_DOMAINS.has(domain.toLowerCase());
}

export function emailDomain(email: string): string {
  const at = email.lastIndexOf('@');
  return at < 0 ? '' : email.slice(at + 1).trim().toLowerCase();
}

const cache = new Map<string, Bank>();

function toIso(value: unknown): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

async function readBanks(where: string, params: unknown[]): Promise<Bank[]> {
  const db = await getDb();
  const { rows } = await db.query(
    `SELECT b.*, (SELECT json_agg(json_build_object('kind', a.kind, 'v', a.updated_at))
                    FROM bank_assets a WHERE a.bank_id = b.id) AS asset_list
       FROM banks b ${where} ORDER BY b.created_at DESC`,
    params
  );
  return rows.map((row: any) => {
    const profile = typeof row.profile === 'string' ? JSON.parse(row.profile) : row.profile;
    const list = typeof row.asset_list === 'string' ? JSON.parse(row.asset_list) : row.asset_list ?? [];
    const assets: Bank['assets'] = {};
    for (const asset of list) assets[asset.kind as AssetKind] = String(new Date(asset.v).getTime());
    const bank: Bank = {
      id: row.id,
      displayName: row.display_name,
      status: row.status,
      statusReason: row.status_reason ?? null,
      adminEmail: row.admin_email,
      profile,
      createdAt: toIso(row.created_at),
      updatedAt: toIso(row.updated_at),
      decidedAt: row.decided_at ? toIso(row.decided_at) : null,
      keep: row.id === DEMO_BANK_ID || row.keep === true,
      assets,
    };
    cache.set(bank.id, bank);
    return bank;
  });
}

export async function getBank(id: string, fresh = false): Promise<Bank | undefined> {
  if (!fresh && cache.has(id)) return cache.get(id);
  const [bank] = await readBanks('WHERE b.id = $1', [id]);
  if (!bank) cache.delete(id);
  return bank;
}

export function listBanks(): Promise<Bank[]> {
  return readBanks('', []);
}

/** Banks that registered this email domain, newest first. Rejected ones are left out. */
export function banksForDomain(domain: string): Promise<Bank[]> {
  if (!domain) return Promise.resolve([]);
  return readBanks(
    `WHERE b.status <> 'rejected' AND b.id IN (SELECT bank_id FROM bank_domains WHERE domain = $1)`,
    [domain.toLowerCase()]
  );
}

export async function bankByName(name: string): Promise<Bank | undefined> {
  const [bank] = await readBanks(`WHERE b.status <> 'rejected' AND lower(b.display_name) = lower($1)`, [name.trim()]);
  return bank;
}

export async function latestRegistrationFor(adminEmail: string): Promise<Bank | undefined> {
  const [bank] = await readBanks('WHERE lower(b.admin_email) = lower($1)', [adminEmail.trim()]);
  return bank;
}

export interface NewBank {
  id?: string;
  displayName: string;
  status: BankStatus;
  profile: BankProfile;
  admin: { name: string; email: string; passwordHash: string };
}

/** Creates the bank row and its first data: the admin user, settings, and sample records if asked for. */
export async function createBank(input: NewBank): Promise<Bank> {
  const db = await getDb();
  const id = input.id ?? `bank-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const domains = [...new Set(input.profile.emailDomains.map((d) => d.toLowerCase()))];
  const profile: BankProfile = { ...input.profile, emailDomains: domains };
  await db.tx(async (query) => {
    await query(
      `INSERT INTO banks (id, display_name, status, admin_email, profile, decided_at)
       VALUES ($1, $2, $3::text, $4, $5::json, CASE WHEN $3::text = 'pending' THEN NULL ELSE now() END)`,
      [id, input.displayName.trim(), input.status, input.admin.email.trim().toLowerCase(), JSON.stringify(profile)]
    );
    for (const domain of domains) {
      await query('INSERT INTO bank_domains (domain, bank_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [domain, id]);
    }
  });

  const bankStore = await getBankStore(id);
  seedNewBank(bankStore.store, profile, input.admin);
  await bankStore.flush();
  return (await getBank(id, true))!;
}

/**
 * First data for a new bank. Settings every bank needs (roles, status codes, layouts,
 * custom fields, SLA) always come from the standard set. Business records come only
 * with sample data, and then the sample users are placeholders nobody can sign in as.
 */
function seedNewBank(store: any, profile: BankProfile, admin: NewBank['admin']): void {
  const data = buildSeedData() as Record<string, any[]>;
  const domain = profile.emailDomains[0];
  const adminUser: User = {
    id: 'user-1',
    name: admin.name,
    email: admin.email.trim().toLowerCase(),
    password: admin.passwordHash,
    role: 'admin',
    active: true,
  };
  const settings = ['customFieldDefs', 'layouts', 'pageLayouts', 'roleDefs', 'statusCodeSets', 'slaConfigs', 'slaRules'];
  if (profile.sampleData) {
    const sampleUsers = (data.users as User[])
      .filter((user) => user.id !== 'user-1')
      .map((user, index) => ({
        ...user,
        name: `${user.name} (sample)`,
        email: `sample.user${index + 2}@${domain}`,
        password: UNUSABLE_PASSWORD,
        active: false,
      }));
    for (const [name, items] of Object.entries(data)) {
      if (name === 'users' || name === 'audit') continue;
      store[name]?.seed(items);
    }
    store.users.seed([adminUser, ...sampleUsers]);
  } else {
    for (const name of settings) store[name].seed(data[name]);
    store.users.seed([adminUser]);
  }
  store.audit.seed([]);
  store.logAudit(admin.name, 'bank.register', `${admin.name} registered the bank`);
}

export async function setBankStatus(id: string, status: BankStatus, reason?: string): Promise<Bank | undefined> {
  const db = await getDb();
  await db.query(
    'UPDATE banks SET status = $2, status_reason = $3, decided_at = now(), updated_at = now() WHERE id = $1',
    [id, status, reason?.trim() || null]
  );
  return getBank(id, true);
}

export async function setBankKeep(id: string, keep: boolean): Promise<Bank | undefined> {
  const db = await getDb();
  await db.query('UPDATE banks SET keep = $2, updated_at = now() WHERE id = $1', [id, keep]);
  return getBank(id, true);
}

export async function updateBankProfile(id: string, displayName: string, profile: BankProfile): Promise<Bank> {
  const db = await getDb();
  const domains = [...new Set(profile.emailDomains.map((d) => d.toLowerCase()))];
  await db.tx(async (query) => {
    await query('UPDATE banks SET display_name = $2, profile = $3::json, updated_at = now() WHERE id = $1', [
      id,
      displayName.trim(),
      JSON.stringify({ ...profile, emailDomains: domains }),
    ]);
    await query('DELETE FROM bank_domains WHERE bank_id = $1', [id]);
    for (const domain of domains) {
      await query('INSERT INTO bank_domains (domain, bank_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [domain, id]);
    }
  });
  return (await getBank(id, true))!;
}

export async function deleteBank(id: string): Promise<boolean> {
  const db = await getDb();
  const { rows } = await db.query('DELETE FROM banks WHERE id = $1 RETURNING id', [id]);
  cache.delete(id);
  forgetBankStore(id);
  return rows.length > 0;
}

/**
 * The console's "Reset data": removes every bank and everything it owns (users,
 * records, images, email domains), except the demo bank and banks marked Keep.
 * The demo bank's own data is not touched.
 */
export async function removeUnkeptBanks(): Promise<{ removed: Bank[]; kept: Bank[] }> {
  const banks = await listBanks();
  const removed = banks.filter((bank) => !bank.keep);
  for (const bank of removed) await deleteBank(bank.id);
  return { removed, kept: banks.filter((bank) => bank.keep) };
}

/** Bytes the database holds now, or null when the engine cannot say. */
export async function databaseSize(): Promise<number | null> {
  try {
    const db = await getDb();
    const { rows } = await db.query<{ bytes: number | string }>('SELECT pg_database_size(current_database()) AS bytes');
    const bytes = Number(rows[0]?.bytes);
    return Number.isFinite(bytes) ? bytes : null;
  } catch {
    return null;
  }
}

export async function recordCounts(): Promise<Map<string, Record<string, number>>> {
  const db = await getDb();
  const { rows } = await db.query<{ bank_id: string; collection: string; n: number }>(
    'SELECT bank_id, collection, count(*) AS n FROM records GROUP BY bank_id, collection'
  );
  const counts = new Map<string, Record<string, number>>();
  for (const row of rows) {
    if (!counts.has(row.bank_id)) counts.set(row.bank_id, {});
    counts.get(row.bank_id)![row.collection] = Number(row.n);
  }
  return counts;
}

// ---------- images ----------

const SIGNATURES: { mime: string; test: (b: Buffer) => boolean }[] = [
  { mime: 'image/png', test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { mime: 'image/jpeg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: 'image/webp', test: (b) => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP' },
];

/**
 * Reads an uploaded image sent as a data URL. Only PNG, JPEG and WebP are accepted,
 * and the type is taken from the file's first bytes, not from what the upload claims
 * (SVG is refused: it can carry scripts).
 */
export function parseImage(dataUrl: string, kind: AssetKind): { mime: string; base64: string } | { problem: string } {
  const match = /^data:([a-z0-9.+/-]+);base64,([A-Za-z0-9+/=\s]+)$/i.exec(dataUrl);
  if (!match) return { problem: 'Upload a PNG, JPEG or WebP image.' };
  const bytes = Buffer.from(match[2], 'base64');
  const found = SIGNATURES.find((signature) => signature.test(bytes));
  if (!found) return { problem: 'Upload a PNG, JPEG or WebP image.' };
  if (bytes.length > ASSET_LIMITS[kind]) {
    return { problem: `The image is too large. The limit is ${ASSET_LIMITS[kind] / (1024 * 1024)} MB.` };
  }
  return { mime: found.mime, base64: bytes.toString('base64') };
}

export async function saveAsset(bankId: string, kind: AssetKind, image: { mime: string; base64: string }): Promise<void> {
  const db = await getDb();
  await db.query(
    `INSERT INTO bank_assets (bank_id, kind, mime, data_b64) VALUES ($1, $2, $3, $4)
     ON CONFLICT (bank_id, kind) DO UPDATE SET mime = EXCLUDED.mime, data_b64 = EXCLUDED.data_b64, updated_at = now()`,
    [bankId, kind, image.mime, image.base64]
  );
  await getBank(bankId, true);
}

export async function removeAsset(bankId: string, kind: AssetKind): Promise<void> {
  const db = await getDb();
  await db.query('DELETE FROM bank_assets WHERE bank_id = $1 AND kind = $2', [bankId, kind]);
  await getBank(bankId, true);
}

export async function readAsset(bankId: string, kind: AssetKind): Promise<{ mime: string; bytes: Buffer } | undefined> {
  const db = await getDb();
  const { rows } = await db.query<{ mime: string; data_b64: string }>(
    'SELECT mime, data_b64 FROM bank_assets WHERE bank_id = $1 AND kind = $2',
    [bankId, kind]
  );
  if (!rows[0]) return undefined;
  return { mime: rows[0].mime, bytes: Buffer.from(rows[0].data_b64, 'base64') };
}

/** What anyone may know about a bank: enough to draw its login page. */
export function publicBank(bank: Bank, apiBase: string) {
  const asset = (kind: AssetKind) =>
    bank.status === 'active' && bank.assets[kind]
      ? `${apiBase}/api/public/banks/${bank.id}/assets/${kind}?v=${bank.assets[kind]}`
      : null;
  return {
    id: bank.id,
    name: bank.displayName,
    status: bank.status,
    color: bank.status === 'active' ? bank.profile.brandColor || null : null,
    logoUrl: asset('logo'),
    loginImageUrl: asset('login'),
  };
}

// ---------- start-up ----------

/** The public demo bank (the practice app's data and demo users). Created once. */
export async function ensureDemoBank(): Promise<void> {
  if (await getBank(DEMO_BANK_ID, true)) return;
  const db = await getDb();
  const profile: BankProfile = {
    legalName: env.demoBankName,
    bankType: 'other',
    registrationNumber: 'DEMO',
    country: 'IN',
    address: 'Demo',
    contactName: 'Alex Admin',
    contactPhone: '',
    contactEmail: 'admin@crm.com',
    emailDomains: ['crm.com'],
    currency: process.env.BANK_CURRENCY?.trim() || 'USD',
    locale: process.env.BANK_LOCALE?.trim() || 'en-US',
    timezone: 'UTC',
    brandColor: process.env.BANK_COLOR?.trim() || '',
    branches: 1,
    expectedUsers: 5,
    sampleData: true,
  };
  await db.tx(async (query) => {
    await query(
      `INSERT INTO banks (id, display_name, status, admin_email, profile, decided_at)
       VALUES ($1, $2, 'active', 'admin@crm.com', $3::json, now()) ON CONFLICT (id) DO NOTHING`,
      [DEMO_BANK_ID, env.demoBankName, JSON.stringify(profile)]
    );
    await query('INSERT INTO bank_domains (domain, bank_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', ['crm.com', DEMO_BANK_ID]);
  });
  const bankStore = await getBankStore(DEMO_BANK_ID);
  bankStore.store.reset();
  await bankStore.flush();
}

export async function ensurePlatformAdmin(): Promise<void> {
  if (!env.platformAdminEmail || !env.platformAdminPassword) return;
  const db = await getDb();
  await db.query(
    `INSERT INTO platform_admins (id, email, name, password_hash) VALUES ('platform-owner', $1, 'Platform owner', $2)
     ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, password_hash = EXCLUDED.password_hash`,
    [env.platformAdminEmail, hashPassword(env.platformAdminPassword)]
  );
}

export async function findPlatformAdmin(email: string) {
  const db = await getDb();
  const { rows } = await db.query<{ id: string; email: string; name: string; password_hash: string }>(
    'SELECT id, email, name, password_hash FROM platform_admins WHERE email = $1',
    [email.trim().toLowerCase()]
  );
  return rows[0];
}
