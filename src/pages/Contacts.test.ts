import { describe, expect, it } from 'vitest';
import { canWriteContacts, contactsEmptyKind } from './Contacts';

describe('canWriteContacts', () => {
  it('allows admin and rep, not viewer', () => {
    expect(canWriteContacts('admin')).toBe(true);
    expect(canWriteContacts('rep')).toBe(true);
    expect(canWriteContacts('viewer')).toBe(false);
    expect(canWriteContacts(undefined)).toBe(false);
  });
});

describe('contactsEmptyKind', () => {
  it('says none-yet only when there are no contacts and no search', () => {
    expect(contactsEmptyKind(0, '')).toBe('none-yet');
    expect(contactsEmptyKind(0, '   ')).toBe('none-yet');
  });

  it('says no-match when a search hides existing contacts or finds nothing', () => {
    expect(contactsEmptyKind(5, 'mina')).toBe('no-match');
    expect(contactsEmptyKind(0, 'mina')).toBe('no-match');
  });
});
