import { createElement, type ReactElement } from 'react';
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
  retryClicks: Array<() => void>(),
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
vi.mock('react/jsx-runtime', async (importOriginal) => {
  type RenderElement = (type: unknown, props: Record<string, unknown>, key?: string) => ReactElement;
  const original = await importOriginal<{ jsx: RenderElement; jsxs: RenderElement }>();
  const captureRetry = (renderElement: RenderElement): RenderElement => (type, props, key) => {
    if (type === 'button' && props['data-testid'] === 'bank-profile-retry') {
      const onClick = props.onClick;
      if (typeof onClick === 'function') harness.retryClicks.push(() => onClick());
    }
    return renderElement(type, props, key);
  };
  return { ...original, jsx: captureRetry(original.jsx), jsxs: captureRetry(original.jsxs) };
});
vi.mock('react/jsx-dev-runtime', async (importOriginal) => {
  type RenderElement = (
    type: unknown, props: Record<string, unknown>, key: string | undefined,
    isStaticChildren: boolean, source: unknown, self: unknown
  ) => ReactElement;
  const original = await importOriginal<{ jsxDEV: RenderElement }>();
  return {
    ...original,
    jsxDEV: (...args: Parameters<RenderElement>) => {
      const [type, props] = args;
      if (type === 'button' && props['data-testid'] === 'bank-profile-retry') {
        const onClick = props.onClick;
        if (typeof onClick === 'function') harness.retryClicks.push(() => onClick());
      }
      return original.jsxDEV(...args);
    },
  };
});
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('../hooks/useMediaQuery', () => ({ useMediaQuery: () => false }));
vi.mock('./CommandBar', () => ({ CommandBar: () => null, isCloseKey: (key: string) => key === 'Escape' }));
vi.mock('./SidebarLink', () => ({ SidebarLink: () => null }));
vi.mock('./feedback-widget', () => ({}));
vi.mock('../data/store', () => ({
  fetchBankProfile: harness.fetchProfile,
  getAllSync: () => [],
  getValue: (_key: string, fallback: unknown) => fallback,
  setValue: vi.fn(),
}));

import { Layout, listenForDismiss } from './Layout';

function render(collapsed = false): string {
  harness.cursor = 0;
  harness.effects = [];
  harness.retryClicks = [];
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

  it.each(['rejected', 'null'])('recovers through the rendered Retry control after a %s response', async (response) => {
    if (response === 'rejected') {
      harness.fetchProfile.mockRejectedValueOnce(new Error('Network unavailable'));
    } else {
      harness.fetchProfile.mockResolvedValueOnce(null);
    }
    render();
    await load();
    expect(render()).toContain('data-testid="bank-profile-error"');

    harness.fetchProfile.mockResolvedValueOnce({ name: 'Redfern Credit Union', logoUrl: null, color: null });
    const retry = harness.retryClicks[0];
    if (!retry) throw new Error('Rendered Retry button has no click handler');
    retry();
    expect(harness.fetchProfile).toHaveBeenCalledTimes(2);
    await Promise.resolve();
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

  it('closes the avatar menu and notifications panel on Escape, not on other keys', () => {
    const listeners = new Map<string, (e: never) => void>();
    const doc = {
      addEventListener: (type: string, fn: (e: never) => void) => { listeners.set(type, fn); },
      removeEventListener: (type: string) => { listeners.delete(type); },
    };
    const onClose = vi.fn();
    const stop = listenForDismiss(doc as unknown as Document, () => false, onClose);
    listeners.get('keydown')?.({ key: 'Enter' } as never);
    expect(onClose).not.toHaveBeenCalled();
    listeners.get('keydown')?.({ key: 'Escape' } as never);
    expect(onClose).toHaveBeenCalledTimes(1);
    stop();
    expect(listeners.size).toBe(0);
  });

  it('still closes on a click outside but not inside', () => {
    const listeners = new Map<string, (e: never) => void>();
    const doc = {
      addEventListener: (type: string, fn: (e: never) => void) => { listeners.set(type, fn); },
      removeEventListener: () => {},
    };
    const onClose = vi.fn();
    listenForDismiss(doc as unknown as Document, (target) => (target as unknown as string) === 'outside', onClose);
    listeners.get('mousedown')?.({ target: 'inside' } as never);
    expect(onClose).not.toHaveBeenCalled();
    listeners.get('mousedown')?.({ target: 'outside' } as never);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('uses the profile logo when supplied', async () => {
    harness.fetchProfile.mockResolvedValue({ name: 'Redfern', logoUrl: '/redfern.svg', color: '#1d3a6e' });
    render();
    await load();
    expect(render()).toContain('src="/redfern.svg"');
  });
});
