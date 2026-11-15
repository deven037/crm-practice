import type { Response } from 'express';
import { COLLECTION_NAMES, Store } from './db.js';
import { getDb } from './pg.js';
import { runWithBankStore } from './context.js';

/**
 * One bank's data in memory, kept in step with the `records` table.
 *
 * A bank's records are read from PostgreSQL the first time the bank is used. Routes
 * then read and change them in memory exactly as before. After every request that
 * may have changed something, flush() compares memory with what was last saved and
 * writes only the difference, in one transaction, before the response is sent.
 *
 * This assumes one API process (which the free hosting plan provides): a second
 * process would not see the first one's changes until it restarted.
 */
export class BankStore {
  readonly store = new Store();
  /** collection -> record id -> the JSON text last saved. */
  private saved = new Map<string, Map<string, string>>();
  private maxSeq = 0;
  private queue: Promise<void> = Promise.resolve();

  constructor(readonly bankId: string) {}

  async load(): Promise<void> {
    const db = await getDb();
    const { rows } = await db.query<{ collection: string; id: string; data: unknown; seq: number }>(
      'SELECT collection, id, data, seq FROM records WHERE bank_id = $1 ORDER BY seq DESC',
      [this.bankId]
    );
    const byCollection = new Map<string, any[]>();
    for (const row of rows) {
      const item = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
      if (!byCollection.has(row.collection)) byCollection.set(row.collection, []);
      byCollection.get(row.collection)!.push(item);
      this.maxSeq = Math.max(this.maxSeq, Number(row.seq));
    }
    for (const name of COLLECTION_NAMES) {
      const items = byCollection.get(name) ?? [];
      (this.store[name] as any).seed(items);
      this.saved.set(name, new Map(items.map((item) => [item.id as string, JSON.stringify(item)])));
    }
  }

  /** Saves whatever changed in memory since the last save. Calls run one after another. */
  flush(): Promise<void> {
    const run = this.queue.then(() => this.saveChanges());
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async saveChanges(): Promise<void> {
    const upserts: string[] = [];
    const deletes: { c: string; i: string }[] = [];
    const next = new Map<string, Map<string, string>>();
    let seq = this.maxSeq;

    for (const name of COLLECTION_NAMES) {
      const before = this.saved.get(name) ?? new Map<string, string>();
      const now = new Map<string, string>();
      const items = (this.store[name] as any).all() as { id: string }[];
      // Walk from the end so the first item in the list gets the highest seq:
      // loading by seq DESC then gives the same order back.
      for (let index = items.length - 1; index >= 0; index--) {
        const item = items[index];
        const json = JSON.stringify(item);
        now.set(item.id, json);
        const old = before.get(item.id);
        if (old === json) continue;
        const rowSeq = old === undefined ? ++seq : null;
        upserts.push(`{"c":${JSON.stringify(name)},"i":${JSON.stringify(item.id)},"s":${rowSeq},"d":${json}}`);
      }
      for (const id of before.keys()) if (!now.has(id)) deletes.push({ c: name, i: id });
      next.set(name, now);
    }

    if (upserts.length === 0 && deletes.length === 0) return;

    const db = await getDb();
    await db.tx(async (query) => {
      if (deletes.length > 0) {
        await query(
          `DELETE FROM records r
             USING json_to_recordset($2::json) AS t(c text, i text)
            WHERE r.bank_id = $1 AND r.collection = t.c AND r.id = t.i`,
          [this.bankId, JSON.stringify(deletes)]
        );
      }
      if (upserts.length > 0) {
        await query(
          `INSERT INTO records (bank_id, collection, id, data, seq)
           SELECT $1, t.c, t.i, t.d, COALESCE(t.s, 0)
             FROM json_to_recordset($2::json) AS t(c text, i text, s bigint, d json)
           ON CONFLICT (bank_id, collection, id)
           DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
          [this.bankId, `[${upserts.join(',')}]`]
        );
      }
    });
    this.saved = next;
    this.maxSeq = seq;
  }

  /** Runs fn with `store` (db.ts) pointing at this bank. */
  run<T>(fn: () => T): T {
    return runWithBankStore(this.bankId, this.store, fn);
  }
}

const loaded = new Map<string, Promise<BankStore>>();

export function getBankStore(bankId: string): Promise<BankStore> {
  let pending = loaded.get(bankId);
  if (!pending) {
    pending = (async () => {
      const bankStore = new BankStore(bankId);
      await bankStore.load();
      return bankStore;
    })();
    loaded.set(bankId, pending);
    pending.catch(() => loaded.delete(bankId));
  }
  return pending;
}

/** Drops a bank's in-memory copy (bank deleted, or tests proving data survives a restart). */
export function forgetBankStore(bankId?: string): void {
  if (bankId) loaded.delete(bankId);
  else loaded.clear();
}

const PATCHED = Symbol('saveBeforeResponse');

/**
 * Holds the response back until this bank's changes are saved. If saving fails the
 * client gets a 500 instead of a success it cannot rely on.
 */
export function saveBeforeResponse(res: Response, bankStore: BankStore): void {
  const marked = res as any;
  if (marked[PATCHED]) return;
  marked[PATCHED] = true;
  const end = res.end.bind(res) as (...args: any[]) => Response;
  (res as any).end = (...args: any[]) => {
    bankStore.flush().then(
      () => end(...args),
      (error) => {
        console.error('Saving changes failed', error);
        if (res.headersSent) return end();
        res.statusCode = 500;
        res.removeHeader('Content-Length');
        res.removeHeader('ETag');
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        end(JSON.stringify({ error: { code: 'save_failed', message: 'Your change could not be saved. Try again.' } }));
      }
    );
    return res;
  };
}
