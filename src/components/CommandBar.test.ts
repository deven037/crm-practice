import { describe, expect, it } from 'vitest';
import { buildOptions } from './CommandBar';

const empty = { items: [], total: 0 };
const hit = (id: string, name: string) => ({ id, name, subtitle: 'Acme' });

describe('buildOptions', () => {
  it('returns nothing before a response arrives', () => {
    expect(buildOptions(null)).toEqual([]);
  });

  it('lists records in type order and adds See all only when there are more matches than shown', () => {
    const options = buildOptions({
      term: 'ann',
      leads: { items: [hit('1', 'Ann Lee'), hit('2', 'Anna Fox'), hit('3', 'Joanne Ray')], total: 5 },
      contacts: { items: [hit('9', 'Ann Cho')], total: 1 },
      accounts: empty,
      deals: empty,
    });
    expect(options.map((o) => o.id)).toEqual(['leads-1', 'leads-2', 'leads-3', 'leads-all', 'contacts-9']);
    expect(options.find((o) => o.id === 'leads-all')).toMatchObject({ label: 'See all 5 leads', to: '/leads?q=ann' });
    expect(options.find((o) => o.id === 'contacts-9')?.to).toBe('/contacts/9');
  });

  it('URL-encodes the term in the See all link', () => {
    const options = buildOptions({
      term: 'a&b c',
      leads: empty,
      contacts: empty,
      accounts: { items: [hit('1', 'A&B Co')], total: 4 },
      deals: empty,
    });
    expect(options.find((o) => o.kind === 'all')?.to).toBe('/accounts?q=a%26b%20c');
  });

  it('joins subtitle, email and phone into the detail line', () => {
    const [option] = buildOptions({
      term: 'ann',
      leads: { items: [{ id: '1', name: 'Ann', subtitle: 'Acme', email: 'a@x.io', phone: '555' }], total: 1 },
      contacts: empty,
      accounts: empty,
      deals: empty,
    });
    expect(option.detail).toBe('Acme, a@x.io, 555');
  });
});
