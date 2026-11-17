import { describe, expect, it } from 'vitest';
import { addTag, allContactTags, contactHue, contactInitials, filterByTags, groupContacts, STARTER_TAGS } from './contactBits';
import { Contact } from '../../types';

const person = (id: string, name: string, accountId: string | null, tags: string[] = []): Contact => ({
  id, name, email: `${id}@example.com`, phone: '', accountId, title: '', tags, avatar: null, notes: [], files: [], createdAt: '',
});
const people = [
  person('c1', 'Zoya Khan', 'a2', ['fleet']),
  person('c2', 'aditi Rao', 'a1', ['signatory', 'vip']),
  person('c3', 'Anil Rao', 'a1'),
  person('c4', '9 Lives Ltd', null, ['vip']),
];
const accountName = (id: string | null) => ({ a1: 'Rao Exports', a2: 'Khan Logistics' })[id ?? ''] ?? '—';

describe('Contacts 3.0 directory helpers', () => {
  it('groups by first letter, sorted, with names that do not start with a letter under #', () => {
    const groups = groupContacts(people, 'letter', accountName);
    expect(groups.map((g) => g.key)).toEqual(['#', 'A', 'Z']);
    expect(groups[1].contacts.map((c) => c.name)).toEqual(['aditi Rao', 'Anil Rao']);
  });

  it('groups by account and keeps people without one together', () => {
    const groups = groupContacts(people, 'account', accountName);
    expect(groups.map((g) => [g.key, g.contacts.length])).toEqual([['Khan Logistics', 1], ['No account', 1], ['Rao Exports', 2]]);
  });

  it('does not reorder the list it was given', () => {
    const before = people.map((c) => c.id);
    groupContacts(people, 'letter', accountName);
    expect(people.map((c) => c.id)).toEqual(before);
  });

  it('lists every tag once, with or without the starter tags', () => {
    expect(allContactTags(people, false)).toEqual(['fleet', 'signatory', 'vip']);
    const withStarters = allContactTags(people);
    for (const tag of [...STARTER_TAGS, 'fleet']) expect(withStarters).toContain(tag);
    expect(withStarters.filter((t) => t === 'vip')).toHaveLength(1);
  });

  it('filters by any chosen tag and passes everything through when none is chosen', () => {
    expect(filterByTags(people, ['vip']).map((c) => c.id)).toEqual(['c2', 'c4']);
    expect(filterByTags(people, ['fleet', 'signatory']).map((c) => c.id)).toEqual(['c1', 'c2']);
    expect(filterByTags(people, [])).toBe(people);
  });

  it('adds a typed tag once, trimmed, and ignores blanks and repeats', () => {
    expect(addTag(['vip'], '  Guarantor, ')).toEqual(['vip', 'Guarantor']);
    const tags = ['vip'];
    expect(addTag(tags, 'VIP')).toBe(tags);
    expect(addTag(tags, '   ')).toBe(tags);
  });

  it('gives a person the same colour every time and initials from the first two names', () => {
    expect(contactHue('c1')).toBe(contactHue('c1'));
    expect(contactHue('c1')).toMatch(/^#[0-9a-f]{6}$/);
    expect(contactInitials('  aditi   rao kumar ')).toBe('AR');
    expect(contactInitials('')).toBe('+');
  });
});
