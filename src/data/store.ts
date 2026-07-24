import { apiFetch, ListEnvelope } from './apiFetch';

const cache: Record<string, any[]> = {};

/** Pre-warms the cache for every collection at boot, since many components read a
 * collection synchronously that their own page never explicitly fetches. */
export async function initStore(): Promise<void> {
  const bootstrap = await apiFetch<Record<string, any[]>>('/bootstrap');
  Object.assign(cache, bootstrap);
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

export async function getById<T extends { id: string }>(key: string, id: string): Promise<T | undefined> {
  try {
    const item = await apiFetch<T>(`/${key}/${id}`);
    const list = cache[key] ?? [];
    const idx = list.findIndex((i) => i.id === id);
    if (idx >= 0) list[idx] = item;
    else list.unshift(item);
    cache[key] = list;
    return item;
  } catch {
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

export async function removeMany(key: string, ids: string[]): Promise<void> {
  await Promise.all(ids.map((id) => apiFetch(`/${key}/${id}`, { method: 'DELETE' })));
  cache[key] = (cache[key] ?? []).filter((i) => !ids.includes(i.id));
}

// ---- sync cache read (populated by initStore/getAll/upsert/removeMany above) ----

export function getAllSync<T>(key: string): T[] {
  return (cache[key] as T[]) ?? [];
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
