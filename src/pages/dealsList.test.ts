import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Deal } from '../types';
import { Kanban } from '../components/Kanban';
import { filterDeals, moveDealOptimistic, sortDeals } from './dealsList';

const deal = (over: Partial<Deal>): Deal => ({
  id: 'd0',
  name: 'Deal',
  accountId: null,
  amount: 0,
  stage: 'Qualification',
  probability: 50,
  closeDate: '2026-12-01',
  ownerId: 'u1',
  createdAt: '2026-11-01',
  ...over,
});

const deals = [
  deal({ id: 'd1', name: 'Linden platform', accountId: 'a1', amount: 210000, stage: 'Negotiation' }),
  deal({ id: 'd2', name: 'Depot upgrade', accountId: 'a2', amount: 180000, stage: 'Closed Won' }),
  deal({ id: 'd3', name: 'Pilot review', accountId: null, amount: 26000 }),
];
const accountName = (id: string | null) => ({ a1: 'Linden & Co.', a2: 'Northquay' })[id ?? ''] ?? 'No account';

describe('filterDeals', () => {
  it('matches the deal name or the account name', () => {
    expect(filterDeals(deals, { query: 'linden', stage: '' }, accountName).map((d) => d.id)).toEqual(['d1']);
    expect(filterDeals(deals, { query: 'northquay', stage: '' }, accountName).map((d) => d.id)).toEqual(['d2']);
  });

  it('open hides Closed stages and a stage filter is exact', () => {
    expect(filterDeals(deals, { query: '', stage: 'open' }, accountName).map((d) => d.id)).toEqual(['d1', 'd3']);
    expect(filterDeals(deals, { query: '', stage: 'Closed Won' }, accountName).map((d) => d.id)).toEqual(['d2']);
  });
});

describe('sortDeals', () => {
  const owner = () => 'Mei';
  it('sorts by amount in both directions without changing the input', () => {
    expect(sortDeals(deals, { key: 'amount', dir: 'desc' }, accountName, owner).map((d) => d.id)).toEqual(['d1', 'd2', 'd3']);
    expect(sortDeals(deals, { key: 'amount', dir: 'asc' }, accountName, owner).map((d) => d.id)).toEqual(['d3', 'd2', 'd1']);
    expect(deals.map((d) => d.id)).toEqual(['d1', 'd2', 'd3']);
  });
});

describe('moveDealOptimistic', () => {
  const original = deal({ id: 'd1', stage: 'Qualification' });
  const updated = { ...original, stage: 'Negotiation' as const };
  const run = async (save: () => Promise<unknown>) => {
    let state = [original];
    const saved = await moveDealOptimistic(original, updated, save, (fn) => {
      state = fn(state);
    });
    return { saved, state };
  };

  it('keeps the move when saving works', async () => {
    const { saved, state } = await run(() => Promise.resolve());
    expect(saved).toBe(true);
    expect(state[0].stage).toBe('Negotiation');
  });

  it('puts the deal back in its old stage when saving fails', async () => {
    const { saved, state } = await run(() => Promise.reject(new Error('network')));
    expect(saved).toBe(false);
    expect(state[0].stage).toBe('Qualification');
  });
});

describe('Kanban move menu', () => {
  const columns = [
    { key: 'A', label: 'Alpha', items: ['x'] },
    { key: 'B', label: 'Beta', items: [] as string[] },
  ];
  const render = (readOnly: boolean, getLabel?: (s: string) => string) =>
    renderToStaticMarkup(
      createElement(Kanban<string>, {
        columns,
        getId: (s) => s,
        cardRenderer: (s) => s,
        onDrop: () => undefined,
        getLabel,
        readOnly,
      })
    );

  it('offers a Move to… menu with the other columns when a label is given', () => {
    const html = render(false, (s) => `Deal ${s}`);
    expect(html).toContain('aria-label="Move Deal x to…"');
    expect(html).toContain('<option value="B">Beta</option>');
    expect(html).not.toContain('<option value="A">');
    expect(html).toContain('role="group" aria-label="Deal x"');
  });

  it('has no menu and no dragging for a read-only viewer, and none by default', () => {
    expect(render(true, (s) => s)).not.toContain('<select');
    expect(render(true, (s) => s)).toContain('draggable="false"');
    expect(render(false)).not.toContain('<select');
  });
});
