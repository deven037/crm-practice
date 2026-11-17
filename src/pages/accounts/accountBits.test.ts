import { describe, expect, it } from 'vitest';
import { Account } from '../../types';
import { accountInitials, filterByIndustry, industryHue, isOpenDeal, mapValues, openPipeline, shortMoney, sortAccounts, squarify, tileSize } from './accountBits';

const account = (id: string, name: string, revenue: number, employees = 10, industry = 'Retail'): Account => ({
  id, name, industry, employees, revenue, website: '', phone: '', ownerId: 'u1', createdAt: '',
});

describe('shortMoney', () => {
  it('shortens thousands, millions and billions', () => {
    expect(shortMoney(650000)).toBe('$650K');
    expect(shortMoney(96000000)).toBe('$96M');
    expect(shortMoney(1500000)).toBe('$1.5M');
    expect(shortMoney(2300000000)).toBe('$2.3B');
    expect(shortMoney(420)).toBe('$420');
  });

  it('shows zero for missing or negative amounts', () => {
    expect(shortMoney(0)).toBe('$0');
    expect(shortMoney(-5)).toBe('$0');
    expect(shortMoney(Number.NaN)).toBe('$0');
  });
});

describe('industryHue', () => {
  it('gives a known industry its own colour whatever the letter case', () => {
    expect(industryHue('Energy')).toBe('#d9642b');
    expect(industryHue(' energy ')).toBe('#d9642b');
  });

  it('gives a bank-specific industry a steady colour', () => {
    expect(industryHue('Shipbuilding')).toBe(industryHue('Shipbuilding'));
    expect(industryHue('Shipbuilding')).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe('accountInitials', () => {
  it('uses the first letters of the first two words', () => {
    expect(accountInitials('Rao Exports Pvt Ltd')).toBe('RE');
    expect(accountInitials('lumen')).toBe('L');
    expect(accountInitials('   ')).toBe('+');
  });
});

describe('open deals', () => {
  const deals = [
    { stage: 'Proposal' as const, amount: 100 },
    { stage: 'Negotiation' as const, amount: 250 },
    { stage: 'Closed Won' as const, amount: 900 },
    { stage: 'Closed Lost' as const, amount: 40 },
  ];

  it('counts every stage before closing as open', () => {
    expect(deals.map(isOpenDeal)).toEqual([true, true, false, false]);
  });

  it('adds up only the open deals for the pipeline', () => {
    expect(openPipeline(deals)).toBe(350);
    expect(openPipeline([])).toBe(0);
  });
});

describe('sortAccounts and filterByIndustry', () => {
  const list = [account('a', 'Beta', 5, 300, 'Energy'), account('b', 'Alpha', 9, 20, 'Retail'), account('c', 'Gamma', 7, 900, 'Energy')];

  it('sorts by revenue, employees or name without changing the original list', () => {
    expect(sortAccounts(list, 'revenue').map((a) => a.id)).toEqual(['b', 'c', 'a']);
    expect(sortAccounts(list, 'employees').map((a) => a.id)).toEqual(['c', 'a', 'b']);
    expect(sortAccounts(list, 'name').map((a) => a.id)).toEqual(['b', 'a', 'c']);
    expect(list.map((a) => a.id)).toEqual(['a', 'b', 'c']);
  });

  it('keeps every account when no industry is picked', () => {
    expect(filterByIndustry(list, [])).toHaveLength(3);
    expect(filterByIndustry(list, ['Energy']).map((a) => a.id)).toEqual(['a', 'c']);
  });
});

describe('squarify', () => {
  const items = [6, 6, 4, 3, 2, 2, 1].map((value, i) => ({ item: `t${i}`, value }));

  it('fills the whole box with one rectangle per item, each in proportion to its value', () => {
    const rects = squarify(items, 600, 400);
    expect(rects).toHaveLength(items.length);
    const total = items.reduce((s, i) => s + i.value, 0);
    for (const [i, r] of rects.entries()) {
      expect(r.w * r.h).toBeCloseTo((items[i].value / total) * 600 * 400, 3);
      expect(r.x).toBeGreaterThanOrEqual(-0.001);
      expect(r.y).toBeGreaterThanOrEqual(-0.001);
      expect(r.x + r.w).toBeLessThanOrEqual(600.001);
      expect(r.y + r.h).toBeLessThanOrEqual(400.001);
    }
  });

  it('never overlaps two rectangles', () => {
    const rects = squarify(items, 600, 400);
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i], b = rects[j];
        const apart = a.x + a.w <= b.x + 0.001 || b.x + b.w <= a.x + 0.001 || a.y + a.h <= b.y + 0.001 || b.y + b.h <= a.y + 0.001;
        expect(apart).toBe(true);
      }
    }
  });

  it('returns nothing until the box has a size', () => {
    expect(squarify(items, 0, 400)).toEqual([]);
    expect(squarify([], 600, 400)).toEqual([]);
  });
});

describe('mapValues', () => {
  it('puts the largest first and keeps very small accounts clickable', () => {
    const values = mapValues([account('s', 'Small', 1000), account('l', 'Large', 100000000), account('m', 'Mid', 40000000)]);
    expect(values.map((v) => v.item.id)).toEqual(['l', 'm', 's']);
    expect(values[2].value).toBe(5000000);
    expect(values[1].value).toBe(40000000);
  });

  it('gives equal tiles when no account has revenue yet', () => {
    expect(mapValues([account('a', 'A', 0), account('b', 'B', 0)]).map((v) => v.value)).toEqual([1, 1]);
  });
});

describe('tileSize', () => {
  it('picks how much a tile can show from its size', () => {
    expect(tileSize(200, 150)).toBe('big');
    expect(tileSize(100, 60)).toBe('mid');
    expect(tileSize(40, 40)).toBe('tiny');
    expect(tileSize(300, 40)).toBe('tiny');
  });
});
