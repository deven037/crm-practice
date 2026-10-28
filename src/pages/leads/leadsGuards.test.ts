import { describe, expect, it } from 'vitest';
import { beginOnce, clearSelection, emptyStateKind, getAriaSort, pageWindow, shouldOpenRowOnKeyDown } from './leadsGuards';

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

describe('pageWindow', () => {
  it('lists every page when there are 7 or fewer', () => {
    expect(pageWindow(1, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it('starts at page 1 near the start', () => {
    expect(pageWindow(2, 12)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('centres on the current page in the middle', () => {
    expect(pageWindow(6, 12)).toEqual([3, 4, 5, 6, 7, 8, 9]);
  });

  it('ends at the last page near the end', () => {
    expect(pageWindow(12, 12)).toEqual([6, 7, 8, 9, 10, 11, 12]);
  });

  it('returns no pages when there are none', () => {
    expect(pageWindow(1, 0)).toEqual([]);
  });
});

describe('emptyStateKind', () => {
  it('reports no leads when the collection is empty', () => {
    expect(emptyStateKind(0)).toBe('no-leads');
  });

  it('reports no matches when leads exist but filters hide them all', () => {
    expect(emptyStateKind(75)).toBe('no-matches');
  });
});

describe('getAriaSort', () => {
  it('returns none when column is not the active sort column', () => {
    expect(getAriaSort('name', 'createdAt', 'desc')).toBe('none');
  });

  it('returns ascending when column is the active sort column and sortDir is asc', () => {
    expect(getAriaSort('name', 'name', 'asc')).toBe('ascending');
  });

  it('returns descending when column is the active sort column and sortDir is desc', () => {
    expect(getAriaSort('name', 'name', 'desc')).toBe('descending');
  });
});

describe('shouldOpenRowOnKeyDown', () => {
  it('returns true when Enter is pressed directly on the row', () => {
    expect(shouldOpenRowOnKeyDown('Enter', true)).toBe(true);
  });

  it('returns false when Enter is pressed on an inner control', () => {
    expect(shouldOpenRowOnKeyDown('Enter', false)).toBe(false);
  });

  it('returns false for other keys even when pressed on the row', () => {
    expect(shouldOpenRowOnKeyDown(' ', true)).toBe(false);
    expect(shouldOpenRowOnKeyDown('Tab', true)).toBe(false);
    expect(shouldOpenRowOnKeyDown('Escape', true)).toBe(false);
  });
});
