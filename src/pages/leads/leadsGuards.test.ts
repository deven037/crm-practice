import { describe, expect, it } from 'vitest';
import { beginOnce, canExportLeads, clearSelection, getAriaSort, shouldOpenRowOnKeyDown } from './leadsGuards';

describe('canExportLeads', () => {
  it('allows admin and rep', () => {
    expect(canExportLeads('admin')).toBe(true);
    expect(canExportLeads('rep')).toBe(true);
  });

  it('denies viewer and a missing role', () => {
    expect(canExportLeads('viewer')).toBe(false);
    expect(canExportLeads(undefined)).toBe(false);
  });
});

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
