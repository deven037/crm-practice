import { createElement, isValidElement, ReactNode } from 'react';
import { beforeEach, expect, it, vi } from 'vitest';

const harness = vi.hoisted(() => ({
  states: Array<unknown>(),
  cursor: 0,
  effects: Array<() => void>(),
  push: vi.fn(),
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
}));
vi.mock('../components/Toast', () => ({ useToast: () => ({ push: harness.push }) }));
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ user: { role: 'admin' } }) }));

import { SlaManagement } from './SlaManagement';

interface NodeProps {
  children?: ReactNode;
  disabled?: boolean;
  value?: string;
  'data-testid'?: string;
  onClick?: () => Promise<void>;
  onChange?: (event: { target: { value: string } }) => void;
}

function nodes(node: ReactNode): import('react').ReactElement<NodeProps>[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!isValidElement<NodeProps>(node)) return [];
  return [node, ...nodes(node.props.children)];
}

function render() {
  harness.cursor = 0;
  return nodes(SlaManagement());
}

function saveButton() {
  const button = render().find((node) => node.type === 'button' && node.props.children === 'Save');
  if (!button) throw new Error('Save button missing');
  return button;
}

beforeEach(() => {
  harness.states = [];
  harness.cursor = 0;
  harness.effects = [];
  harness.push.mockReset();
  vi.unstubAllGlobals();
});

it('shows feedback for a rejected PUT, preserves the draft, and enables a successful retry', async () => {
  const config = { id: 'sla-urgent', priority: 'Urgent', hours: 48 };
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ data: [config], totalPages: 1 })))
    .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'QA417 controlled SLA failure' }), { status: 500 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ ...config, hours: 6 })))
    .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ ...config, hours: 6 }], totalPages: 1 })));
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('localStorage', { getItem: () => null });
  vi.stubGlobal('sessionStorage', { getItem: () => null });

  render();
  harness.effects[0]?.();
  await vi.waitFor(() => expect(saveButton().props.disabled).toBe(false));
  const input = render().find((node) => node.props['data-testid'] === 'sla-hours-urgent');
  expect(input).toBeDefined();
  input?.props.onChange?.({ target: { value: '6' } });

  const failedSave = saveButton().props.onClick?.();
  expect(saveButton().props.disabled).toBe(true);
  await expect(failedSave).resolves.toBeUndefined();
  expect(harness.push).toHaveBeenCalledWith('error', 'Could not save Urgent SLA. Try again.');
  expect(harness.push).not.toHaveBeenCalledWith('success', expect.anything());
  expect(saveButton().props.disabled).toBe(false);
  expect(render().find((node) => node.props['data-testid'] === 'sla-hours-urgent')?.props.value).toBe('6');
  expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/slaConfigs/sla-urgent', expect.objectContaining({
    method: 'PUT', body: JSON.stringify({ ...config, hours: 6 }),
  }));
  expect(fetchMock).toHaveBeenCalledTimes(2);

  await saveButton().props.onClick?.();
  expect(harness.push).toHaveBeenCalledWith('success', 'Urgent SLA set to 6h.');
  expect(saveButton().props.disabled).toBe(false);
  expect(fetchMock).toHaveBeenNthCalledWith(3, '/api/slaConfigs/sla-urgent', expect.objectContaining({
    method: 'PUT', body: JSON.stringify({ ...config, hours: 6 }),
  }));
});
