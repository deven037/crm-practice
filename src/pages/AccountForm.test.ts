import { createElement, isValidElement, ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const harness = vi.hoisted(() => ({
  states: [] as unknown[],
  cursor: 0,
  upsert: vi.fn(),
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
}));
vi.mock('react-router-dom', () => ({
  Link: ({ to, children }: { to: string; children: ReactNode }) => createElement('a', { href: to }, children),
  useNavigate: () => vi.fn(),
  useSearchParams: () => [new URLSearchParams()],
}));
vi.mock('../data/store', () => ({
  getAllSync: () => [],
  newId: () => 'account-1',
  upsert: harness.upsert,
}));
vi.mock('../components/Select', () => ({
  Select: ({ id }: { id?: string }) => createElement('button', { id, type: 'button' }),
}));
vi.mock('../components/CustomFieldsSection', () => ({ CustomFieldsSection: () => null, validateCustomFields: () => ({}) }));
vi.mock('../components/Toast', () => ({ useToast: () => ({ push: vi.fn() }) }));
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('../utils/moduleFields', () => ({ getCustomFieldsAsModuleFields: () => [] }));
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
