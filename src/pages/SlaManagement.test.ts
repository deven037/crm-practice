import { createElement, isValidElement, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const harness = vi.hoisted(() => ({
  states: Array<unknown>(),
  cursor: 0,
  effects: Array<() => void>(),
  push: vi.fn(),
  role: 'admin',
}));

vi.mock('react', async (original) => ({
  ...await original<typeof import('react')>(),
  useEffect: (effect: () => void) => { harness.effects.push(effect); },
  useState: (initial: unknown) => {
    const index = harness.cursor++;
    if (!(index in harness.states)) harness.states[index] = typeof initial === 'function' ? (initial as () => unknown)() : initial;
    return [harness.states[index], (value: unknown) => {
      harness.states[index] = typeof value === 'function' ? (value as (v: unknown) => unknown)(harness.states[index]) : value;
    }];
  },
}));
vi.mock('react-router-dom', () => ({
  Link: ({ to, children }: { to: string; children: ReactNode }) => createElement('a', { href: to }, children),
}));
vi.mock('../components/Toast', () => ({ useToast: () => ({ push: harness.push }) }));
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ user: { id: 'user-1', role: harness.role } }) }));

import { scaleX, SlaManagement, stepHours } from './SlaManagement';

interface NodeProps {
  children?: ReactNode;
  footer?: ReactNode;
  disabled?: boolean;
  'data-testid'?: string;
  onClick?: () => Promise<void> | void;
  onChange?: () => void;
}

function nodes(node: ReactNode): import('react').ReactElement<NodeProps>[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!isValidElement<NodeProps>(node)) return [];
  return [node, ...nodes(node.props.children), ...nodes(node.props.footer)];
}

function render() {
  harness.cursor = 0;
  harness.effects = [];
  return nodes(SlaManagement());
}
const byId = (id: string) => render().find((node) => node.props['data-testid'] === id);
const text = (id: string) => String(byId(id)?.props.children);

const policy = {
  configs: [
    { id: 'sla-low', priority: 'Low', hours: 48, firstReplyHours: 8, clock: 'working' },
    { id: 'sla-urgent', priority: 'Urgent', hours: 4, firstReplyHours: 0.25, clock: '24x7' },
    { id: 'sla-high', priority: 'High', hours: 8, firstReplyHours: 1, clock: '24x7' },
    { id: 'sla-medium', priority: 'Medium', hours: 24, firstReplyHours: 4, clock: 'working' },
  ],
  rules: {
    id: 'sla-rules', warnPercent: 80, notifyOnWarn: true, escalateOnBreach: true, level1UserId: null, level2: true, level2AfterMinutes: 120, level2UserId: null,
    autoAssign: true, autoAssignMinutes: 30, pauseStatuses: ['Waiting on customer'], workingDays: [1, 2, 3, 4, 5, 6], workFrom: '09:00', workTo: '18:00', timeZone: 'Asia/Kolkata',
  },
};

async function load(fetchMock: ReturnType<typeof vi.fn>, ready = 'sla-row-urgent') {
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('localStorage', { getItem: () => null });
  vi.stubGlobal('sessionStorage', { getItem: () => null });
  render();
  harness.effects[0]?.();
  await vi.waitFor(() => expect(byId(ready)).toBeDefined());
}

beforeEach(() => {
  harness.states = [];
  harness.cursor = 0;
  harness.effects = [];
  harness.role = 'admin';
  harness.push.mockReset();
  vi.unstubAllGlobals();
});

describe('SLA policies page', () => {
  it('lists priorities from Urgent to Low and saves nothing until something changes', async () => {
    await load(vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(policy))));
    const rows = render().filter((n) => String(n.props['data-testid'] ?? '').startsWith('sla-row-')).map((n) => n.props['data-testid']);
    expect(rows).toEqual(['sla-row-urgent', 'sla-row-high', 'sla-row-medium', 'sla-row-low']);
    expect(byId('sla-save')?.props.disabled).toBe(true);
    expect(byId('sla-unsaved')).toBeUndefined();
    expect(text('sla-first-urgent')).toBe('15 m');
  });

  it('keeps the draft after a failed save, asks about open tickets, and saves on retry', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(policy)))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 'save_failed', message: 'Your change could not be saved. Try again.' } }), { status: 500 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ...policy, configs: policy.configs.map((c) => (c.priority === 'Urgent' ? { ...c, hours: 8 } : c)), moved: 3 })));
    await load(fetchMock);

    byId('sla-hours-urgent-more')?.props.onClick?.();
    expect(text('sla-hours-urgent')).toBe('8 h');
    expect(byId('sla-unsaved')).toBeDefined();
    byId('sla-save')?.props.onClick?.();
    byId('sla-apply-all')?.props.onChange?.();

    await byId('sla-confirm-save')?.props.onClick?.();
    expect(harness.push).toHaveBeenCalledWith('error', expect.any(String));
    expect(text('sla-hours-urgent')).toBe('8 h');
    expect(byId('sla-confirm-save')).toBeDefined();

    await byId('sla-confirm-save')?.props.onClick?.();
    expect(harness.push).toHaveBeenCalledWith('success', 'SLA policy saved. 3 open tickets recalculated.');
    expect(byId('sla-unsaved')).toBeUndefined();
    const body = JSON.parse(fetchMock.mock.calls[2][1].body);
    expect(body.apply).toBe('all');
    expect(body.configs.find((c: { priority: string }) => c.priority === 'Urgent')).toEqual({ priority: 'Urgent', hours: 8, firstReplyHours: 0.25, clock: '24x7' });
    expect(body.rules.id).toBeUndefined();
    expect(fetchMock.mock.calls[2][0]).toBe('/api/slaConfigs/policy');
  });

  it('refuses a first reply that is not before the resolve time', async () => {
    await load(vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(policy))));
    byId('sla-first-urgent-more')?.props.onClick?.(); // 30 m
    byId('sla-first-urgent-more')?.props.onClick?.(); // 1 h
    byId('sla-first-urgent-more')?.props.onClick?.(); // 2 h
    byId('sla-first-urgent-more')?.props.onClick?.(); // 4 h would equal the resolve time
    expect(text('sla-first-urgent')).toBe('2 h');
    expect(harness.push).toHaveBeenCalledWith('error', 'The first reply must come before the resolve time.');
  });

  it('is view only for reps', async () => {
    harness.role = 'rep';
    await load(vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(policy))));
    expect(byId('sla-save')).toBeUndefined();
    expect(byId('sla-hours-urgent-more')?.props.disabled).toBe(true);
  });
});

describe('SLA steps', () => {
  it('moves along the steps and snaps a value between two steps', () => {
    expect(stepHours(4, 1)).toBe(8);
    expect(stepHours(4, -1)).toBe(2);
    expect(stepHours(5, 1)).toBe(8);
    expect(stepHours(5, -1)).toBe(4);
    expect(stepHours(0.25, -1)).toBe(0.25);
    expect(stepHours(120, 1)).toBe(120);
  });

  it('draws a log scale that grows with the hours', () => {
    expect(scaleX(1)).toBeLessThan(scaleX(4));
    expect(scaleX(4)).toBeLessThan(scaleX(72));
    expect(scaleX(500)).toBe(100);
  });
});
