import { isValidElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LayoutPickerPanel } from './LayoutPickerPanel';
import { SlideOver } from './SlideOver';

const harness = vi.hoisted(() => ({ effects: [] as (() => void | (() => void))[] }));
vi.mock('react', async (original) => ({
  ...await original<typeof import('react')>(),
  useEffect: (effect: () => void | (() => void)) => { harness.effects.push(effect); },
}));
vi.mock('react-dom', () => ({ createPortal: (children: import('react').ReactNode) => children }));
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ user: { role: 'admin' } }) }));
vi.mock('../data/store', () => ({ getAllSync: () => [] }));
afterEach(() => { vi.unstubAllGlobals(); harness.effects = []; });

describe('LayoutPickerPanel keyboard lifecycle', () => {
  it('executes picker and SlideOver effects, wraps focus, dismisses on Escape and removes listeners', () => {
    const events = new EventTarget();
    let active: Control | null = null;
    class Control { focus() { active = this; } }
    vi.stubGlobal('HTMLElement', Control);
    const opener = new Control(), close = new Control(), firstLayout = new Control(), lastLayout = new Control();
    const controls = [close, firstLayout, lastLayout];
    const add = vi.fn(events.addEventListener.bind(events));
    const remove = vi.fn(events.removeEventListener.bind(events));
    vi.stubGlobal('document', {
      body: {},
      get activeElement() { return active; },
      querySelector: () => ({ querySelectorAll: () => controls, contains: (value: Control) => controls.includes(value) }),
      addEventListener: add, removeEventListener: remove,
    });
    const onClose = vi.fn();
    opener.focus();
    const picker = LayoutPickerPanel({ module: 'contacts', basePath: '/contacts', onClose });
    if (!isValidElement<Parameters<typeof SlideOver>[0]>(picker) || picker.type !== SlideOver) throw new Error('Picker must render SlideOver');
    SlideOver(picker.props);
    expect(harness.effects).toHaveLength(2);
    const cleanups = harness.effects.map((effect) => effect());
    expect(active).toBe(close);
    const key = (value: string, shiftKey = false) => {
      const event = Object.assign(new Event('keydown', { cancelable: true }), { key: value, shiftKey });
      events.dispatchEvent(event);
      return event;
    };
    expect(key('Tab', true).defaultPrevented).toBe(true);
    expect(active).toBe(lastLayout);
    expect(key('Tab').defaultPrevented).toBe(true);
    expect(active).toBe(close);
    firstLayout.focus();
    expect(key('Tab').defaultPrevented).toBe(false);
    opener.focus();
    expect(key('Tab').defaultPrevented).toBe(true);
    expect(active).toBe(close);
    key('Escape');
    expect(onClose).toHaveBeenCalledTimes(1);
    cleanups.forEach((cleanup) => cleanup?.());
    expect(active).toBe(opener);
    expect(add).toHaveBeenCalledTimes(2);
    expect(remove.mock.calls).toEqual(add.mock.calls);
    expect(key('Tab').defaultPrevented).toBe(false);
    key('Escape');
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(active).toBe(opener);
  });
});
