import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { upsert } from '../data/store';
import { runRecoverable } from './accountRecovery';

const account = { id: 'account-new', name: 'QA Draft Account' };

beforeEach(() => {
  const empty = { getItem: () => null, removeItem: () => undefined };
  vi.stubGlobal('localStorage', empty);
  vi.stubGlobal('sessionStorage', empty);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('account create form: save rejected by the server', () => {
  it('shows the error and re-enables the button when POST /api/accounts returns 500', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ error: { code: 'server_error', message: 'Simulated save failure' } }), { status: 500 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const calls: string[] = [];

    const saved = await runRecoverable(() => upsert('accounts', account), {
      setBusy: (busy) => calls.push(`busy:${busy}`),
      setError: (failed) => calls.push(`error:${failed}`),
    });

    expect(saved).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(calls).toEqual(['busy:true', 'error:false', 'error:true', 'busy:false']);
  });
});
