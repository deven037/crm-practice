import { createElement, isValidElement, ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const harness = vi.hoisted(() => ({
  states: [] as unknown[],
  cursor: 0,
  effects: [] as (() => void)[],
  ref: { current: null as unknown },
}));

vi.mock('react', async (original) => ({
  ...await original<typeof import('react')>(),
  useState: (initial: unknown) => {
    const index = harness.cursor++;
    if (!(index in harness.states)) harness.states[index] = initial;
    return [harness.states[index], (value: unknown) => {
      harness.states[index] = typeof value === 'function' ? value(harness.states[index]) : value;
    }];
  },
  useEffect: (effect: () => void) => { harness.effects.push(effect); },
  useRef: () => harness.ref,
}));
vi.mock('react-router-dom', () => ({
  Link: ({ to, children }: { to: string; children: ReactNode }) => createElement('a', { href: to }, children),
  useNavigate: () => vi.fn(),
  useSearchParams: () => [new URLSearchParams()],
}));
vi.mock('../data/store', () => ({
  getAllSync: (key: string) => key === 'pageLayouts' ? [{
    id: 'default', module: 'contacts', isDefault: true, name: 'Default',
    tabs: [{ id: 'details', label: 'Contact details', fieldKeys: ['name', 'email', 'phone', 'title'] }],
  }] : [],
  newId: () => 'contact-1',
  upsert: vi.fn(),
}));
vi.mock('../components/Select', () => ({ MultiSelect: () => null, SearchableSelect: () => null }));
vi.mock('../components/CustomFieldsSection', () => ({
  CustomFieldsSection: () => null,
  validateCustomFields: () => ({}),
}));
vi.mock('../components/Toast', () => ({ useToast: () => ({ push: vi.fn() }) }));
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('../utils/rules', () => ({ findDuplicate: () => null }));
vi.mock('../utils/moduleFields', () => ({ getCustomFieldsAsModuleFields: () => [] }));
vi.mock('../utils', () => ({ classNames: (...values: (string | false)[]) => values.filter(Boolean).join(' ') }));

import { ContactForm } from './ContactForm';

interface NodeProps {
  children?: ReactNode;
  onClick?: () => unknown;
}
function nodes(node: ReactNode): import('react').ReactElement<NodeProps>[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!isValidElement<NodeProps>(node)) return [];
  return [node, ...nodes(node.props.children)];
}

beforeEach(() => {
  harness.states = [];
  harness.cursor = 0;
  harness.effects = [];
  harness.ref.current = { querySelector: vi.fn(() => ({ focus: vi.fn() })) };
});

describe('ContactForm accessibility', () => {
  it('associates labels with all contact text inputs', () => {
    const html = renderToStaticMarkup(ContactForm());
    for (const field of ['name', 'email', 'phone', 'title']) {
      expect(html).toContain(`for="contact-${field}"`);
      expect(html).toContain(`id="contact-${field}"`);
    }
  });

  it('describes validation errors and focuses the first invalid input', async () => {
    const initial = ContactForm();
    const submit = nodes(initial).find((node) => node.type === 'button' && node.props.children === 'Create contact');
    await submit?.props.onClick?.();

    harness.cursor = 0;
    harness.effects = [];
    const updated = ContactForm();
    const html = renderToStaticMarkup(updated);
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('aria-describedby="contact-name-error"');
    expect(html).toContain('Name is required.');
    const focus = vi.fn();
    const querySelector = vi.fn(() => ({ focus }));
    harness.ref.current = { querySelector };
    harness.effects[0]();
    expect(querySelector).toHaveBeenCalledWith('[aria-invalid="true"]');
    expect(focus).toHaveBeenCalledOnce();
  });
});
