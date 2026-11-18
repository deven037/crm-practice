import { apiFetch, ListEnvelope } from './apiFetch';

const cache: Record<string, any[]> = {};

export interface BankProfile {
  name: string;
  logoUrl: string | null;
  color: string | null;
  currency?: string;
  locale?: string;
  timezone?: string;
}

let bankProfile: BankProfile | null = null;

/** The signed-in bank's name, logo, colour and region, as last loaded. Null before sign-in. */
export function bankProfileSync(): BankProfile | null {
  return bankProfile;
}

type BootstrapPayload = Record<string, any[]> & { bankProfile?: BankProfile | null };

/** Pre-warms the cache for every collection at boot, since many components read a
 * collection synchronously that their own page never explicitly fetches. */
export async function initStore(): Promise<void> {
  const { bankProfile: profile, ...collections } = await apiFetch<BootstrapPayload>('/bootstrap');
  bankProfile = profile ?? null;
  // A different bank may have signed in on this device: drop what the last one left behind.
  for (const key of Object.keys(cache)) delete cache[key];
  Object.assign(cache, collections);
}

/** Loads the bank profile for the app shell; null when the server has none. Throws when the request fails. */
export async function fetchBankProfile(): Promise<BankProfile | null> {
  const payload = await apiFetch<BootstrapPayload>('/bootstrap');
  bankProfile = payload.bankProfile ?? null;
  return bankProfile;
}

// ---- async repository (real network calls) ----

export async function getAll<T>(key: string): Promise<T[]> {
  const first = await apiFetch<ListEnvelope<T>>(`/${key}?pageSize=100`);
  let rows = first.data;
  for (let page = 2; page <= first.totalPages; page++) {
    const next = await apiFetch<ListEnvelope<T>>(`/${key}?pageSize=100&page=${page}`);
    rows = rows.concat(next.data);
  }
  cache[key] = rows;
  return rows;
}

export async function getById<T extends { id: string }>(key: string, id: string, throwOnError = false): Promise<T | undefined> {
  try {
    const item = await apiFetch<T>(`/${key}/${id}`);
    const list = cache[key] ?? [];
    const idx = list.findIndex((i) => i.id === id);
    if (idx >= 0) list[idx] = item;
    else list.unshift(item);
    cache[key] = list;
    return item;
  } catch (error) {
    if (throwOnError) throw error;
    return undefined;
  }
}

export async function saveAll<T extends { id: string }>(key: string, items: T[]): Promise<T[]> {
  const saved = await Promise.all(items.map((item) => upsert(key, item)));
  return saved;
}

export async function upsert<T extends { id: string }>(key: string, item: T): Promise<T> {
  const exists = (cache[key] ?? []).some((i) => i.id === item.id);
  const saved = exists
    ? await apiFetch<T>(`/${key}/${item.id}`, { method: 'PUT', body: JSON.stringify(item) })
    : await apiFetch<T>(`/${key}`, { method: 'POST', body: JSON.stringify(item) });
  const list = cache[key] ?? [];
  const idx = list.findIndex((i) => i.id === (saved as any).id);
  if (idx >= 0) list[idx] = saved;
  else list.unshift(saved);
  cache[key] = list;
  return saved;
}

/** `confirm` is sent as ?confirm=… for deletes the server guards (for example a Closed Won deal). */
export async function removeMany(key: string, ids: string[], confirm?: string): Promise<void> {
  const query = confirm ? `?confirm=${encodeURIComponent(confirm)}` : '';
  await Promise.all(ids.map((id) => apiFetch(`/${key}/${id}${query}`, { method: 'DELETE' })));
  cache[key] = (cache[key] ?? []).filter((i) => !ids.includes(i.id));
}

// ---- sync cache read (populated by initStore/getAll/upsert/removeMany above) ----

export function getAllSync<T>(key: string): T[] {
  return (cache[key] as T[]) ?? [];
}

/** Replaces a cached collection after a save that is not a plain list (for example the quote settings row). */
export function setCached<T>(key: string, rows: T[]): void {
  cache[key] = rows;
}

// ---- theme/prefs: pure client/device preferences, stay on localStorage unchanged ----

const PREFIX = 'crm.';

function writeRaw(key: string, value: unknown) {
  localStorage.setItem(PREFIX + key, JSON.stringify(value));
}

function readRaw<T>(key: string, fallback: T): T {
  const raw = localStorage.getItem(PREFIX + key);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function setValue(key: string, value: unknown) {
  writeRaw(key, value);
}

export function getValue<T>(key: string, fallback: T): T {
  return readRaw<T>(key, fallback);
}

export function removeValue(key: string) {
  localStorage.removeItem(PREFIX + key);
}

let idCounter = 0;

/** Client-side id generator — the server accepts (and uses) an optional client-supplied
 * id on create, so existing call sites that build a full object before upsert()ing it
 * don't need to change. */
export function newId(prefix: string) {
  return `${prefix}-${Date.now()}-${idCounter++}`;
}
