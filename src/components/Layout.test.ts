import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const harness = vi.hoisted(() => {
  vi.stubEnv('VITE_BANK_NAME', 'APEX');
  vi.stubEnv('VITE_BANK_LOGO_URL', '/environment-logo.svg');
  return {
  states: Array<unknown>(),
  cursor: 0,
  effects: Array<() => void>(),
  fetchProfile: vi.fn(),
  };
});

vi.mock('react', async (importOriginal) => ({
  ...await importOriginal<typeof import('react')>(),
  useState: (initial: unknown) => {
    const index = harness.cursor++;
    if (!(index in harness.states)) {
      harness.states[index] = typeof initial === 'function' ? initial() : initial;
    }
    return [harness.states[index], (value: unknown) => {
      harness.states[index] = typeof value === 'function' ? value(harness.states[index]) : value;
    }];
  },
  useEffect: (effect: () => void) => { harness.effects.push(effect); },
}));
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('../hooks/useMediaQuery', () => ({ useMediaQuery: () => false }));
vi.mock('./CommandBar', () => ({ CommandBar: () => null }));
vi.mock('./SidebarLink', () => ({ SidebarLink: () => null }));
vi.mock('./feedback-widget', () => ({}));
vi.mock('../data/store', () => ({
  fetchBankProfile: harness.fetchProfile,
  getAllSync: () => [],
  getValue: (_key: string, fallback: unknown) => fallback,
  setValue: vi.fn(),
}));

import { Layout } from './Layout';

function render(collapsed = false): string {
  harness.cursor = 0;
  harness.effects = [];
  return renderToStaticMarkup(createElement(Layout, { children: null, initialSidebarCollapsed: collapsed }));
}

async function load(): Promise<void> {
  const effect = harness.effects[0];
  if (!effect) throw new Error('Profile load effect was not registered');
  effect();
  await Promise.resolve();
}

beforeEach(() => {
  harness.states = [];
  harness.fetchProfile.mockReset();
});

describe('bank profile fallback and recovery', () => {
  it.each([undefined, null])('shows Harbor and Retry when bootstrap has no profile (%s)', async (profile) => {
    harness.fetchProfile.mockResolvedValue(profile);
    render();
    await load();
    const html = render();
    expect(html).toContain('role="alert"');
    expect(html).toContain('data-testid="bank-profile-retry"');
    expect(html).toContain('>Harbor CRM</span>');
    expect(html).toContain('data-bank-profile="default"');
    expect(html).not.toContain('APEX');
    expect(html).not.toContain('/environment-logo.svg');
  });

  it('recovers from a request failure using the same loader bound to Retry', async () => {
    harness.fetchProfile.mockRejectedValueOnce(new Error('Network unavailable'));
    render();
    await load();
    expect(render()).toContain('data-testid="bank-profile-error"');

    harness.fetchProfile.mockResolvedValueOnce({ name: 'Redfern Credit Union', logoUrl: null, color: null });
    await load();
    const html = render();
    expect(harness.fetchProfile).toHaveBeenCalledTimes(2);
    expect(html).not.toContain('data-testid="bank-profile-error"');
    expect(html).toContain('>Redfern Credit Union</span>');
    expect(html).not.toContain('class="brand-logo"');
    expect(html).toContain('data-bank-profile="default"');
  });

  it('keeps a bank without a logo named when the sidebar is collapsed', async () => {
    harness.fetchProfile.mockResolvedValue({ name: 'Redfern Credit Union', logoUrl: null, color: null });
    render(true);
    await load();
    const html = render(true);
    expect(html).toContain('>Redfern Credit Union</span>');
    expect(html).not.toContain('class="brand-logo"');
  });

  it('uses the profile logo when supplied', async () => {
    harness.fetchProfile.mockResolvedValue({ name: 'Redfern', logoUrl: '/redfern.svg', color: '#1d3a6e' });
    render();
    await load();
    expect(render()).toContain('src="/redfern.svg"');
  });
});
