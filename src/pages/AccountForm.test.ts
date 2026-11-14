import { createElement, isValidElement, ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const harness = vi.hoisted(() => ({
  states: [] as unknown[],
  cursor: 0,
  upsert: vi.fn(),
  effects: [] as (() => void)[],
  layouts: [] as { module: string; isDefault: boolean; tabs: { id: string; fieldKeys: string[] }[] }[],
  customErrors: {} as Record<string, string>,
}));

vi.mock('react', async (original) => ({
  ...await original<typeof import('react')>(),
  useEffect: (effect: () => void) => { harness.effects.push(effect); },
  useState: (initial: unknown) => {
    const index = harness.cursor++;
    if (!(index in harness.states)) harness.states[index] = initial;
    return [harness.states[index], (value: unknown) => {
      harness.states[index] = typeof value === 'function' ? value(harness.states[index]) : value;
    }];
  },
}));
vi.mock('react-router-dom', () => ({
  Link: ({ to, children }: { to: string; children: ReactNode }) => createElement('a', { href: to }, children),
  useNavigate: () => vi.fn(),
  useSearchParams: () => [new URLSearchParams()],
}));
vi.mock('../data/store', () => ({
  getAllSync: (key: string) => key === 'pageLayouts' ? harness.layouts : key === 'customFieldDefs'
    ? [{ id: 'custom-id', key: 'custom-key', module: 'accounts' }] : [],
  newId: () => 'account-1',
  upsert: harness.upsert,
}));
vi.mock('../components/Select', () => ({
  Select: ({ id }: { id?: string }) => createElement('button', { id, type: 'button' }),
}));
vi.mock('../components/CustomFieldsSection', () => ({ CustomFieldsSection: () => null, validateCustomFields: () => harness.customErrors }));
vi.mock('../components/Toast', () => ({ useToast: () => ({ push: vi.fn() }) }));
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('../utils/moduleFields', () => ({ getCustomFieldsAsModuleFields: () => [{ key: 'custom-id' }] }));
vi.mock('../utils', () => ({ classNames: (...values: (string | false)[]) => values.filter(Boolean).join(' ') }));

import { AccountForm } from './AccountForm';

interface NodeProps {
  children?: ReactNode;
  id?: string;
  onClick?: () => unknown;
  onChange?: (event: { target: { value: string } }) => void;
}
function nodes(node: ReactNode): import('react').ReactElement<NodeProps>[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!isValidElement<NodeProps>(node)) return [];
  return [node, ...nodes(node.props.children)];
}

beforeEach(() => {
  harness.states = [];
  harness.cursor = 0;
  harness.upsert.mockReset();
  harness.effects = [];
  harness.layouts = [];
  harness.customErrors = {};
  vi.unstubAllGlobals();
});

describe('AccountForm accessibility and validation', () => {
  it('ties the labels of every field to their controls', () => {
    const html = renderToStaticMarkup(AccountForm());
    for (const field of ['name', 'industry', 'employees', 'revenue', 'website', 'phone', 'owner']) {
      expect(html).toContain(`for="account-${field}-input"`);
      expect(html).toContain(`id="account-${field}-input"`);
    }
  });

  it('shows field errors for negative employees and revenue and sends no request', async () => {
    nodes(AccountForm()).find((node) => node.props.id === 'account-employees-input')?.props.onChange?.({ target: { value: '-5' } });
    harness.cursor = 0;
    nodes(AccountForm()).find((node) => node.props.id === 'account-revenue-input')?.props.onChange?.({ target: { value: '-10' } });
    harness.cursor = 0;
    const submit = nodes(AccountForm()).find((node) => node.type === 'button' && node.props.children === 'Create account');
    await submit?.props.onClick?.();

    harness.cursor = 0;
    const html = renderToStaticMarkup(AccountForm());
    expect(html).toContain('Employees can’t be negative.');
    expect(html).toContain('Annual revenue can’t be negative.');
    expect(html).toContain('aria-describedby="account-employees-error"');
    expect(html).toContain('aria-describedby="account-revenue-error"');
    expect(html).toContain('value="-5"');
    expect(html).toContain('value="-10"');
    expect(harness.upsert).not.toHaveBeenCalled();
  });
});

it.each([
  { field: 'name', value: '', errorId: 'account-name-error' },
  { field: 'website', value: 'notaurl', errorId: 'account-website-error' },
  { field: 'employees', value: '-1', errorId: 'account-employees-error' },
  { field: 'revenue', value: '-1', errorId: 'account-revenue-error' },
])('reveals and focuses invalid $field after rendering its associated error', async ({ field, value, errorId }) => {
  harness.layouts = [{ module: 'accounts', isDefault: true, tabs: [
    { id: 'other', fieldKeys: ['phone'] },
    { id: 'invalid', fieldKeys: [field] },
  ] }];
  nodes(AccountForm());
  harness.states[0] = 'invalid';
  harness.cursor = 0;
  nodes(AccountForm()).find((node) => node.props.id === `account-${field}-input`)?.props.onChange?.({ target: { value } });
  harness.states[0] = 'other';
  harness.cursor = 0;
  await nodes(AccountForm()).find((node) => node.props.children === 'Create account')?.props.onClick?.();
  expect(harness.states[0]).toBe('invalid');
  harness.effects = [];
  harness.cursor = 0;
  const html = renderToStaticMarkup(AccountForm());
  const focus = vi.fn(() => {
    expect(html).toContain(`id="account-${field}-input"`);
    expect(html).toContain(`aria-describedby="${errorId}"`);
    expect(html).toContain('aria-invalid="true"');
  });
  const querySelector = vi.fn(() => ({ focus }));
  vi.stubGlobal('document', { querySelector });
  harness.effects.forEach((effect) => effect());
  expect(querySelector).toHaveBeenCalledWith('[data-testid="account-form-page"] [aria-invalid="true"]');
  expect(focus).toHaveBeenCalledOnce();
  expect(harness.upsert).not.toHaveBeenCalled();
});

it('reveals a required custom field on an inactive tab before focusing', async () => {
  harness.layouts = [{ module: 'accounts', isDefault: true, tabs: [
    { id: 'details', fieldKeys: ['phone'] },
    { id: 'custom', fieldKeys: ['custom-id'] },
  ] }];
  harness.customErrors = { 'custom-key': 'Custom field is required.' };
  await nodes(AccountForm()).find((node) => node.props.children === 'Create account')?.props.onClick?.();
  expect(harness.states[0]).toBe('custom');
  harness.cursor = 0;
  harness.effects = [];
  AccountForm();
  const focus = vi.fn();
  vi.stubGlobal('document', { querySelector: vi.fn(() => ({ focus })) });
  harness.effects.forEach((effect) => effect());
  expect(focus).toHaveBeenCalledOnce();
  expect(harness.upsert).not.toHaveBeenCalled();
});
