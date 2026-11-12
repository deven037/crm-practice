import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const harness = vi.hoisted(() => ({
  states: Array<unknown>(),
  cursor: 0,
  effects: Array<() => void>(),
  token: 'token' as string | null,
  apiFetch: vi.fn(),
  initStore: vi.fn(),
}));

vi.mock('react', async (importOriginal) => ({
  ...await importOriginal<typeof import('react')>(),
  useState: (initial: unknown) => {
    const index = harness.cursor++;
    if (!(index in harness.states)) harness.states[index] = initial;
    return [harness.states[index], (value: unknown) => { harness.states[index] = value; }];
  },
  useEffect: (effect: () => void) => { harness.effects.push(effect); },
}));
vi.mock('../data/apiFetch', () => ({
  apiFetch: harness.apiFetch,
  getToken: () => harness.token,
  setToken: vi.fn(),
  clearToken: vi.fn(),
}));
vi.mock('../data/store', () => ({ initStore: harness.initStore }));

import { AuthProvider } from './AuthContext';

const me = { id: 'u1', email: 'admin@crm.com' };

function render(): void {
  harness.cursor = 0;
  harness.effects = [];
  renderToStaticMarkup(createElement(AuthProvider, { children: null }));
}

async function restoreSession(): Promise<unknown> {
  render();
  harness.effects[0]?.();
  await new Promise((resolve) => setTimeout(resolve, 0));
  return harness.states[0];
}

beforeEach(() => {
  harness.states = [];
  harness.token = 'token';
  harness.apiFetch.mockReset().mockResolvedValue(me);
  harness.initStore.mockReset();
});

describe('restoring the session when /api/bootstrap fails', () => {
  it('keeps the user signed in when the bootstrap request fails but the session is valid', async () => {
    harness.initStore.mockRejectedValue(new Error('Request failed (503)'));
    expect(await restoreSession()).toEqual(me);
  });

  it('signs the user out when bootstrap answers 401 and the token was cleared', async () => {
    harness.initStore.mockImplementation(async () => {
      harness.token = null;
      throw new Error('Session expired');
    });
    expect(await restoreSession()).toBeNull();
  });
});
