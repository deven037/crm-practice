import { createElement, isValidElement, ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const harness = vi.hoisted(() => ({
  states: [] as unknown[], cursor: 0, role: 'admin', effects: [] as (() => void | (() => void))[],
}));
vi.mock('react', async (original) => ({
  ...await original<typeof import('react')>(),
  useEffect: (effect: () => void | (() => void)) => { harness.effects.push(effect); },
  useRef: () => ({ current: null }),
  useState: (initial: unknown) => {
    const index = harness.cursor++;
    if (!(index in harness.states)) harness.states[index] = initial;
    return [harness.states[index], (value: unknown) => { harness.states[index] = typeof value === 'function' ? value(harness.states[index]) : value; }];
  },
}));
vi.mock('react-router-dom', () => ({
  Link: ({ to, children }: { to: string; children: ReactNode }) => createElement('a', { href: to }, children),
  useNavigate: () => vi.fn(), useParams: () => ({ id: 'contact-1' }),
}));
vi.mock('../data/store', () => ({ getAllSync: () => [], upsert: vi.fn(), removeMany: vi.fn(), newId: () => 'note-1' }));
vi.mock('../components/Toast', () => ({ useToast: () => ({ push: vi.fn() }) }));
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ user: { role: harness.role } }) }));
vi.mock('../hooks/useRecentlyViewed', () => ({ useRecentlyViewed: () => ({ recordView: vi.fn() }) }));
vi.mock('../components/Select', () => ({ MultiSelect: () => null, SearchableSelect: () => null }));
vi.mock('../components/CustomFieldsSection', () => ({ CustomFieldsSection: () => null, validateCustomFields: () => ({}) }));
vi.mock('../components/Tabs', () => ({ Tabs: ({ tabs }: { tabs: { content: ReactNode }[] }) => createElement('div', {}, tabs.map((tab, index) => createElement('section', { key: index }, tab.content))) }));

import { ContactDetail } from './ContactDetail';
import { upsert } from '../data/store';
import { apiFetch } from '../data/apiFetch';
import { Modal } from '../components/Modal';
vi.mock('../data/apiFetch', () => ({ apiFetch: vi.fn() }));
vi.mock('react-dom', () => ({ createPortal: (children: ReactNode) => children }));
interface Props {
  children?: ReactNode;
  tabs?: { content: ReactNode }[];
  'data-testid'?: string;
  footer?: ReactNode;
  title?: string;
  onClose?: () => void;
  onClick?: () => void;
  onSubmit?: (event: { preventDefault: () => void }) => Promise<void>;
}
function nodes(node: ReactNode): import('react').ReactElement<Props>[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!isValidElement<Props>(node)) return [];
  return [node, ...nodes(node.props.children), ...(node.props.tabs ?? []).flatMap((tab) => nodes(tab.content))];
}
const contact = {
  id: 'contact-1', name: 'Amara', email: 'amara@example.com', phone: '', title: '',
  accountId: null, avatar: null, tags: [], notes: [], files: [], createdAt: '2026-10-01', layoutName: null,
};
beforeEach(() => {
  vi.clearAllMocks();
  harness.cursor = 0; harness.role = 'admin'; harness.effects = [];
  harness.states = [contact, false, { ...contact }, true, '', false];
});
describe('ContactDetail save states', () => {
  it('rejects invalid email before persistence', async () => {
    harness.states[2] = { ...contact, email: 'invalid' };
    const tree = ContactDetail();
    await nodes(tree).find((node) => node.type === 'form')?.props.onSubmit?.({ preventDefault: vi.fn() });
    harness.cursor = 0;
    const html = renderToStaticMarkup(ContactDetail());
    expect(html).toContain('Enter a valid email.');
    expect(html).toContain('aria-describedby="edit-contact-email-error"');
    expect(upsert).not.toHaveBeenCalled();
  });
  it('preserves edit mode and draft after network rejection', async () => {
    vi.mocked(upsert).mockRejectedValueOnce(new Error('Network failure'));
    const tree = ContactDetail();
    await nodes(tree).find((node) => node.type === 'form')?.props.onSubmit?.({ preventDefault: vi.fn() });
    harness.cursor = 0;
    const html = renderToStaticMarkup(ContactDetail());
    expect(html).toContain('Changes couldn’t be saved. Your details are still here.');
    expect(html).toContain('value="amara@example.com"');
    expect(harness.states[3]).toBe(true);
    expect(html.match(/<form[\s\S]*?<\/form>/)?.[0]).not.toContain('disabled=""');
  });
  it('hides write actions for viewers and shows the notes empty state', () => {
    harness.role = 'viewer'; harness.states[3] = false;
    const html = renderToStaticMarkup(ContactDetail());
    expect(html).toMatch(/hidden=""[^>]*data-testid="edit-contact-btn"/);
    expect(html).toMatch(/hidden=""[^>]*data-testid="delete-contact-btn"/);
    expect(html).not.toContain('data-testid="note-input"');
    expect(html).toContain('No notes yet.');
  });
});

afterEach(() => vi.unstubAllGlobals());

function render() {
  harness.cursor = 0;
  harness.effects = [];
  return ContactDetail();
}

describe('ContactDetail load recovery', () => {
  it('runs the failed load, shows Retry, and loads the record on retry', async () => {
    harness.states = [];
    vi.mocked(apiFetch).mockRejectedValueOnce(new Error('Network failure')).mockResolvedValueOnce(contact);
    expect(renderToStaticMarkup(render())).toContain('Loading contact');
    harness.effects[0]();
    await Promise.resolve();
    let tree = render();
    expect(renderToStaticMarkup(tree)).toContain('Contact couldn’t be loaded.');
    nodes(tree).find((node) => node.type === 'button' && node.props.children === 'Retry')?.props.onClick?.();
    render();
    harness.effects[0]();
    await Promise.resolve();
    tree = render();
    expect(renderToStaticMarkup(tree)).toContain('Amara');
    expect(renderToStaticMarkup(tree)).not.toContain('Contact couldn’t be loaded.');
    expect(apiFetch).toHaveBeenNthCalledWith(2, '/contacts/contact-1');
  });
});

describe('ContactDetail delete dialog keyboard behavior', () => {
  it('focuses the dialog, wraps both Tab directions, closes on Escape and restores the opener', () => {
    const events = new EventTarget();
    let active: FocusControl | null = null;
    class FocusControl {
      focus() { active = this; }
    }
    vi.stubGlobal('HTMLElement', FocusControl);
    const opener = new FocusControl(), close = new FocusControl(), cancel = new FocusControl(), confirm = new FocusControl();
    const controls = [close, cancel, confirm];
    const dialog = { querySelectorAll: () => controls, contains: (value: FocusControl) => controls.includes(value) };
    vi.stubGlobal('document', {
      get activeElement() { return active; },
      querySelector: () => dialog, body: {},
      addEventListener: events.addEventListener.bind(events),
      removeEventListener: events.removeEventListener.bind(events),
    });
    harness.states[3] = false;
    opener.focus();
    nodes(render()).find((node) => node.props['data-testid'] === 'delete-contact-btn')?.props.onClick?.();
    const tree = render();
    const modal = nodes(tree).find((node) => node.type === Modal);
    if (!modal?.props.title || !modal.props.onClose) throw new Error('Delete dialog did not open');
    Modal({ title: modal.props.title, onClose: modal.props.onClose, children: modal.props.children, footer: modal.props.footer });
    const cleanupFocus = harness.effects[2]();
    const cleanupEscape = harness.effects[harness.effects.length - 1]();
    expect(active).toBe(close);
    const key = (value: string, shiftKey = false) => {
      const event = Object.assign(new Event('keydown', { cancelable: true }), { key: value, shiftKey });
      events.dispatchEvent(event);
      return event;
    };
    expect(key('Tab', true).defaultPrevented).toBe(true);
    expect(active).toBe(confirm);
    expect(key('Tab').defaultPrevented).toBe(true);
    expect(active).toBe(close);
    cancel.focus();
    expect(key('Tab').defaultPrevented).toBe(false);
    key('Escape');
    expect(harness.states[5]).toBe(false);
    cleanupFocus?.();
    cleanupEscape?.();
    expect(active).toBe(opener);
    expect(nodes(render()).some((node) => node.type === Modal)).toBe(false);
  });
});
