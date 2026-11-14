import { createElement, isValidElement, ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const harness = vi.hoisted(() => ({
  states: [] as unknown[],
  cursor: 0,
  role: 'admin',
  splitLayout: false,
  omitCustom: false,
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
  getAllSync: (key: string) => {
    if (key === 'pageLayouts') return [{
      id: 'default', module: 'contacts', isDefault: true, name: 'Default',
      tabs: harness.splitLayout ? [
        { id: 'phone', label: 'Phone', fieldKeys: ['phone'] },
        { id: 'details', label: 'Contact details', fieldKeys: ['name', 'email', 'title'] },
        { id: 'custom', label: 'Branch information', fieldKeys: harness.omitCustom ? [] : ['custom-name'] },
      ] : [{ id: 'details', label: 'Contact details', fieldKeys: ['name', 'email', 'phone', 'title', 'custom-name'] }],
    }];
    if (key === 'customFieldDefs') return [{
      id: 'custom-name', module: 'contacts', key: 'customName', label: 'Custom name', type: 'text', required: true,
    }];
    if (key === 'layouts') return [{ id: 'contact-form', module: 'contacts', target: 'form', fieldIds: ['custom-name'] }];
    return [];
  },
  newId: () => 'contact-1',
  upsert: vi.fn(),
}));
vi.mock('../components/Select', () => ({ Select: () => null, MultiSelect: () => null, SearchableSelect: () => null }));
vi.mock('../components/Toast', () => ({ useToast: () => ({ push: vi.fn() }) }));
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ user: { role: harness.role } }) }));
vi.mock('../utils/rules', () => ({ findDuplicate: () => null }));
vi.mock('../utils/moduleFields', () => ({ getCustomFieldsAsModuleFields: () => [{ key: 'custom-name' }] }));
vi.mock('../utils', () => ({
  classNames: (...values: (string | false)[]) => values.filter(Boolean).join(' '),
  formatDate: (value: string) => value,
}));

import { upsert } from '../data/store';
import { ContactForm } from './ContactForm';

interface NodeProps {
  children?: ReactNode;
  id?: string;
  onClick?: () => unknown;
  onSubmit?: (event: { preventDefault: () => void }) => unknown;
  onChange?: (event: { target: { value: string } }) => void;
}
function nodes(node: ReactNode): import('react').ReactElement<NodeProps>[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!isValidElement<NodeProps>(node)) return [];
  return [node, ...nodes(node.props.children)];
}

beforeEach(() => {
  harness.role = 'admin';
  harness.splitLayout = false;
  harness.omitCustom = false;
  vi.clearAllMocks();
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
    const submit = nodes(initial).find((node) => node.type === 'form');
    await submit?.props.onSubmit?.({ preventDefault: vi.fn() });

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

  it('marks a required custom field invalid and focuses it when standard fields are valid', async () => {
    const initial = ContactForm();
    nodes(initial).find((node) => node.props.id === 'contact-name')?.props.onChange?.({ target: { value: 'Morgan' } });

    harness.cursor = 0;
    harness.effects = [];
    const withName = ContactForm();
    nodes(withName).find((node) => node.props.id === 'contact-email')?.props.onChange?.({ target: { value: 'morgan@example.com' } });

    harness.cursor = 0;
    harness.effects = [];
    const ready = ContactForm();
    const submit = nodes(ready).find((node) => node.type === 'form');
    await submit?.props.onSubmit?.({ preventDefault: vi.fn() });

    harness.cursor = 0;
    harness.effects = [];
    const updated = ContactForm();
    const html = renderToStaticMarkup(updated);
    expect(html).toContain('for="custom-field-custom-name"');
    expect(html).toContain('id="custom-field-custom-name"');
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('aria-describedby="custom-field-custom-name-error"');
    expect(html).toContain('Custom name is required.');
    expect(html).not.toContain('aria-describedby="contact-name-error"');

    const focus = vi.fn();
    const querySelector = vi.fn(() => ({ focus }));
    harness.ref.current = { querySelector };
    harness.effects[0]();
    expect(querySelector).toHaveBeenCalledWith('[aria-invalid="true"]');
    expect(focus).toHaveBeenCalledOnce();
  });
});

describe('ContactForm Harbor states', () => {
  it('keeps viewers read-only', () => {
    harness.role = 'viewer';
    const html = renderToStaticMarkup(ContactForm());
    expect(html).toContain('read-only access');
    expect(html).not.toContain('<form');
  });

  it('keeps entries and enables retry after a rejected save', async () => {
    let tree = ContactForm();
    nodes(tree).find((node) => node.props.id === 'contact-name')?.props.onChange?.({ target: { value: 'Morgan' } });
    harness.cursor = 0;
    tree = ContactForm();
    nodes(tree).find((node) => node.props.id === 'contact-email')?.props.onChange?.({ target: { value: 'morgan@example.com' } });
    const draft = harness.states[1];
    if (typeof draft !== 'object' || draft === null) throw new Error('Missing contact draft');
    harness.states[1] = { ...draft, customFields: { customName: 'Branch' } };
    harness.cursor = 0;
    tree = ContactForm();
    vi.mocked(upsert).mockRejectedValueOnce(new Error('Network failure'));
    await nodes(tree).find((node) => node.type === 'form')?.props.onSubmit?.({ preventDefault: vi.fn() });
    harness.cursor = 0;
    const html = renderToStaticMarkup(ContactForm());
    expect(upsert).toHaveBeenCalledOnce();
    expect(html).toContain('Contact couldn’t be saved. Your details are still here.');
    expect(html).toContain('value="morgan@example.com"');
    expect(html).not.toContain('disabled=""');
  });
});

describe('ContactForm cross-tab validation', () => {
  it.each(['standard', 'custom'])('reveals and focuses an invalid %s field on an inactive tab', async (kind) => {
    harness.splitLayout = true;
    let tree = ContactForm();
    if (kind === 'custom') {
      const draft = harness.states[1];
      if (typeof draft !== 'object' || draft === null) throw new Error('Missing draft');
      harness.states[1] = { ...draft, name: 'Amara', email: 'amara@example.com' };
      harness.cursor = 0;
      tree = ContactForm();
    }
    expect(renderToStaticMarkup(tree)).not.toContain('aria-invalid="true"');
    await nodes(tree).find((node) => node.type === 'form')?.props.onSubmit?.({ preventDefault: vi.fn() });
    harness.cursor = 0;
    harness.effects = [];
    const html = renderToStaticMarkup(ContactForm());
    const id = kind === 'standard' ? 'contact-name' : 'custom-field-custom-name';
    expect(harness.states[0]).toBe(kind === 'standard' ? 'details' : 'custom');
    expect(html).toContain('id="' + id + '"');
    expect(html).toContain('aria-describedby="' + id + '-error"');
    const focus = vi.fn();
    harness.ref.current = { querySelector: vi.fn(() => ({ focus })) };
    harness.effects[0]();
    expect(focus).toHaveBeenCalledOnce();
    expect(upsert).not.toHaveBeenCalled();
  });
});

it('does not block a chosen layout on required custom fields omitted from that layout', async () => {
  harness.splitLayout = true;
  harness.omitCustom = true;
  ContactForm();
  const draft = harness.states[1];
  if (typeof draft !== 'object' || draft === null) throw new Error('Missing draft');
  harness.states[1] = { ...draft, name: 'Amara', email: 'amara@example.com' };
  harness.cursor = 0;
  vi.mocked(upsert).mockResolvedValueOnce({ ...draft, id: 'contact-1', name: 'Amara' });
  await nodes(ContactForm()).find((node) => node.type === 'form')?.props.onSubmit?.({ preventDefault: vi.fn() });
  expect(upsert).toHaveBeenCalledOnce();
});
