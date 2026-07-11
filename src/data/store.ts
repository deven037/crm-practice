import { buildSeedData } from './seed';
import { AuditEntry } from '../types';

const PREFIX = 'crm.';

/**
 * Simulated network latency so spinners/skeletons genuinely appear and
 * automated tests have to wait properly instead of relying on instant DOM.
 * The wide 300–1200ms spread makes fixed sleeps unreliable by design.
 */
export const delay = (min = 300, max = 1200) =>
  new Promise<void>((resolve) => setTimeout(resolve, min + Math.random() * (max - min)));

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

export function seedDatabase() {
  const data = buildSeedData();
  Object.entries(data).forEach(([key, value]) => writeRaw(key, value));
  writeRaw('seeded', true);
}

export function ensureSeeded() {
  if (localStorage.getItem(PREFIX + 'seeded') === null) {
    seedDatabase();
    return;
  }
  // Migration: collections added in later versions (e.g. products) get seeded
  // into existing storage without touching the user's other data.
  const data = buildSeedData();
  Object.entries(data).forEach(([key, value]) => {
    if (localStorage.getItem(PREFIX + key) === null) writeRaw(key, value);
  });
}

/** Wipe every crm.* key (including session) and reseed from scratch. */
export function resetData() {
  Object.keys(localStorage)
    .filter((k) => k.startsWith(PREFIX))
    .forEach((k) => localStorage.removeItem(k));
  seedDatabase();
}

// ---- async repository (goes through simulated latency) ----

export async function getAll<T>(key: string): Promise<T[]> {
  await delay();
  return readRaw<T[]>(key, []);
}

export async function getById<T extends { id: string }>(key: string, id: string): Promise<T | undefined> {
  await delay();
  return readRaw<T[]>(key, []).find((item) => item.id === id);
}

export async function saveAll<T>(key: string, items: T[]): Promise<T[]> {
  await delay(150, 400);
  writeRaw(key, items);
  return items;
}

export async function upsert<T extends { id: string }>(key: string, item: T): Promise<T> {
  await delay(150, 400);
  const items = readRaw<T[]>(key, []);
  const idx = items.findIndex((i) => i.id === item.id);
  if (idx >= 0) items[idx] = item;
  else items.unshift(item);
  writeRaw(key, items);
  return item;
}

export async function removeMany(key: string, ids: string[]): Promise<void> {
  await delay(150, 400);
  const items = readRaw<{ id: string }[]>(key, []);
  writeRaw(
    key,
    items.filter((i) => !ids.includes(i.id))
  );
}

// ---- sync helpers (no latency; used for session/theme/audit bookkeeping) ----

export function getAllSync<T>(key: string): T[] {
  return readRaw<T[]>(key, []);
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

let auditCounter = 0;

export function logAudit(user: string, action: string, detail: string) {
  const entries = readRaw<AuditEntry[]>('audit', []);
  entries.unshift({
    id: `audit-${Date.now()}-${auditCounter++}`,
    user,
    action,
    detail,
    when: new Date().toISOString(),
  });
  writeRaw('audit', entries.slice(0, 200));
}

let idCounter = 0;

export function newId(prefix: string) {
  return `${prefix}-${Date.now()}-${idCounter++}`;
}
