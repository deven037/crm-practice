import { describe, expect, it } from 'vitest';
import { accountsEmptyKind, canWriteAccounts } from './Accounts';

describe('canWriteAccounts', () => {
  it('allows admin and rep, not viewer', () => {
    expect(canWriteAccounts('admin')).toBe(true);
    expect(canWriteAccounts('rep')).toBe(true);
    expect(canWriteAccounts('viewer')).toBe(false);
    expect(canWriteAccounts(undefined)).toBe(false);
  });
});

describe('accountsEmptyKind', () => {
  it('says none-yet only when there are no accounts and no search', () => {
    expect(accountsEmptyKind(0, '')).toBe('none-yet');
    expect(accountsEmptyKind(0, '   ')).toBe('none-yet');
  });

  it('says no-match when a search hides existing accounts or finds nothing', () => {
    expect(accountsEmptyKind(6, 'linden')).toBe('no-match');
    expect(accountsEmptyKind(0, 'linden')).toBe('no-match');
  });
});
