import { describe, expect, it } from 'vitest';
import { beginOnce, clearSelection } from './leadsGuards';

describe('clearSelection', () => {
  it('returns an empty selection', () => {
    expect(clearSelection()).toEqual([]);
  });

  it('returns a new array each time', () => {
    expect(clearSelection()).not.toBe(clearSelection());
  });
});

describe('beginOnce', () => {
  it('lets only the first of several rapid Finish clicks through', () => {
    const flag = { current: false };
    const results = [beginOnce(flag), beginOnce(flag), beginOnce(flag)];
    expect(results).toEqual([true, false, false]);
  });

  it('lets a new submission through once the flag is released', () => {
    const flag = { current: false };
    beginOnce(flag);
    flag.current = false;
    expect(beginOnce(flag)).toBe(true);
  });
});
