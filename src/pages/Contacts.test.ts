import { describe, expect, it } from 'vitest';
import { canWriteContacts, contactsEmptyKind } from './Contacts';

describe('canWriteContacts', () => {
  it('allows admin and rep, not viewer', () => {
    expect(canWriteContacts('admin')).toBe(true);
    expect(canWriteContacts('rep')).toBe(true);
    expect(canWriteContacts('viewer')).toBe(false);
    expect(canWriteContacts(undefined)).toBe(false);
  });
});

describe('contactsEmptyKind', () => {
  it('says none-yet only when there are no contacts and no search', () => {
    expect(contactsEmptyKind(0, '')).toBe('none-yet');
    expect(contactsEmptyKind(0, '   ')).toBe('none-yet');
  });

  it('says no-match when a search hides existing contacts or finds nothing', () => {
    expect(contactsEmptyKind(5, 'mina')).toBe('no-match');
    expect(contactsEmptyKind(0, 'mina')).toBe('no-match');
  });
});

import { createElement, isValidElement, ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, vi } from 'vitest';
import { Contacts, EmailTooltip } from './Contacts';
import { Contact, Role } from '../types';

const harness = vi.hoisted(() => {
  const states: unknown[] = [];
  const effects: (() => void)[] = [];
  return {
  states,
  cursor: 0,
  effects,
  role: 'viewer',
  request: vi.fn(),
  navigate: vi.fn(),
  };
});
vi.mock('react', async (original) => ({
  ...await original<typeof import('react')>(),
  useMemo: (factory: () => unknown) => factory(),
  useState: (initial: unknown) => {
    const index = harness.cursor++;
    if (!(index in harness.states)) harness.states[index] = initial;
    return [harness.states[index], (value: unknown) => {
      harness.states[index] = typeof value === 'function' ? value(harness.states[index]) : value;
    }];
  },
  useEffect: (effect: () => void) => { harness.effects.push(effect); },
}));
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ user: { role: harness.role } }) }));
vi.mock('../data/store', () => ({
  getAll: (...args: unknown[]) => harness.request(...args),
  getAllSync: () => [],
  removeMany: vi.fn(),
}));
vi.mock('../components/Toast', () => ({ useToast: () => ({ push: vi.fn() }) }));
vi.mock('../components/ToolBoxPanel', () => ({ ToolBoxPanel: () => null }));
vi.mock('react-router-dom', async (original) => ({
  ...await original<typeof import('react-router-dom')>(),
  useNavigate: () => harness.navigate,
  useLocation: () => ({ state: null }),
  useSearchParams: () => [new URLSearchParams()],
}));

interface NodeProps {
  children?: ReactNode;
  onClick?: (event: { stopPropagation: () => void }) => unknown;
  onChange?: () => void;
  to?: string;
  type?: string;
  'aria-label'?: string;
}
function nodes(node: ReactNode): import('react').ReactElement<NodeProps>[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!isValidElement<NodeProps>(node)) return [];
  return [node, ...nodes(node.props.children)];
}
function render() {
  harness.cursor = 0;
  harness.effects = [];
  const tree = Contacts();
  return {
    elements: nodes(tree),
    html: renderToStaticMarkup(createElement(MemoryRouter, null, tree)),
  };
}
function click(label: string) {
  const button = render().elements.find((node) =>
    node.type === 'button' && (node.props.children === label || node.props['aria-label'] === label));
  expect(button?.props.onClick).toBeTypeOf('function');
  return button?.props.onClick?.({ stopPropagation: vi.fn() });
}
const contact: Contact = {
  id: 'c1', name: 'Mina Shah', email: 'mina@example.com', phone: '123',
  accountId: null, title: 'Director', tags: [], avatar: null, notes: [], files: [], createdAt: '',
};
beforeEach(() => {
  harness.states = [];
  harness.cursor = 0;
  harness.effects = [];
  harness.role = 'viewer';
  harness.request.mockReset();
  harness.navigate.mockReset();
});

describe('Contacts rendered behavior', () => {
  it('shows loading, failure and Retry recovery without a false empty state', async () => {
    let rejectRequest: (error: Error) => void = () => undefined;
    let resolveRequest: (rows: Contact[]) => void = () => undefined;
    harness.request
      .mockImplementationOnce(() => new Promise<Contact[]>((_resolve, reject) => { rejectRequest = reject; }))
      .mockImplementationOnce(() => new Promise<Contact[]>((resolve) => { resolveRequest = resolve; }));
    expect(render().html).toContain('skeleton');
    harness.effects[0]();
    rejectRequest(new Error('Connection failed'));
    await Promise.resolve();
    let html = render().html;
    expect(html).toContain('contacts-load-error');
    expect(html).not.toContain('No contacts');
    const retry = click('Retry');
    html = render().html;
    expect(html).toContain('skeleton');
    expect(html).not.toContain('contacts-load-error');
    expect(html).not.toContain('No contacts');
    resolveRequest([contact]);
    await retry;
    html = render().html;
    expect(html).toContain('Mina Shah');
    expect(html).not.toContain('skeleton');
    expect(html).not.toContain('contacts-load-error');
    expect(html).not.toContain('No contacts');
    expect(harness.request.mock.calls).toEqual([['contacts'], ['contacts']]);
  });

  it.each<Role>(['viewer', 'rep', 'admin'])('renders controls and native navigation for %s in both views', async (role) => {
    harness.role = role;
    harness.request.mockResolvedValue([contact]);
    render();
    harness.effects[0]();
    await Promise.resolve();
    for (const view of ['Grid view', 'List view']) {
      click(view);
      const { html, elements } = render();
      expect(html.includes('+ New Contact')).toBe(role !== 'viewer');
      expect(html.includes('type="checkbox"')).toBe(view === 'List view' && role !== 'viewer');
      // A native anchor with href participates in Tab order and Enter activation.
      expect(html).toMatch(/<a[^>]*href="\/contacts\/c1"[^>]*>Mina Shah<\/a>/);
      const link = elements.find((node) => node.props.to === '/contacts/c1');
      const stopPropagation = vi.fn();
      link?.props.onClick?.({ stopPropagation });
      expect(stopPropagation).toHaveBeenCalledOnce();
      if (view === 'List view' && role !== 'viewer') {
        const checkbox = elements.find((node) => node.props['aria-label'] === 'Select Mina Shah');
        const cell = elements.find((node) => node.type === 'td' && nodes(node.props.children).some((child) => child === checkbox));
        cell?.props.onClick?.({ stopPropagation });
        expect(stopPropagation).toHaveBeenCalledTimes(2);
        checkbox?.props.onChange?.();
        expect(render().html).toContain('Delete');
        expect(harness.navigate).not.toHaveBeenCalled();
      }
    }
  });
});

describe('EmailTooltip', () => {
  it('is keyboard focusable and carries the full email in Grid and List cells', () => {
    for (const as of ['div', 'td'] as const) {
      const html = renderToStaticMarkup(createElement(as === 'td' ? 'tr' : 'div', null, createElement(EmailTooltip, { as, email: 'meera.mehta@example.com' })));
      expect(html).toContain('tabindex="0"');
      expect(html).toContain('data-tooltip="meera.mehta@example.com"');
      expect(html).toContain('has-tooltip');
    }
  });
});
