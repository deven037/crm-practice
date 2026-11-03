import { describe, expect, it } from 'vitest';
import { filterContacts } from './Contacts';
import { filterAccounts } from './Accounts';
import { filterLeads } from './Leads';
import { Account, Contact, Lead } from '../types';

const account: Account = {
  id: 'aurora', name: 'Aurora Analytics', industry: 'Consulting', phone: '+91 (987) 654-3210',
  employees: 1, revenue: 0, website: '', ownerId: 'rep', createdAt: '',
};
const contact: Contact = {
  id: 'meera', name: 'Meera Iyer', email: 'meera@example.test', phone: account.phone,
  accountId: account.id, title: '', tags: [], avatar: null, notes: [], files: [], createdAt: '',
};
const lead: Lead = {
  id: 'lead', name: contact.name, company: account.name, email: contact.email, phone: account.phone,
  status: 'New', source: 'Website', ownerId: 'rep', value: 0, createdAt: '',
  notes: [], files: [],
};

describe('See all destination matching', () => {
  it('keeps company-only contact matches and excludes industry-only account matches', () => {
    expect(filterContacts([contact], ' ro ', 'rep', [account])).toEqual([contact]);
    expect(filterAccounts([account], 'in', 'rep')).toEqual([]);
    expect(filterAccounts([account], 'AURORA', 'rep')).toEqual([account]);
    expect(filterContacts([contact], 'meera', 'rep', [])).toEqual([contact]);
    expect(filterContacts([{ ...contact, accountId: null }], 'aurora', 'rep', [account])).toEqual([]);
  });

  it.each(['987654', '(987) 654', '987-654', '987.654'])('normalizes phone query %s for all three destinations', (term) => {
    expect(filterContacts([contact], term, 'rep', [account])).toEqual([contact]);
    expect(filterAccounts([account], term, 'rep')).toEqual([account]);
    expect(filterLeads([lead], term, 'rep')).toEqual([lead]);
  });

  it.each(['admin', 'rep'] as const)('matches email for %s', (role) => {
    expect(filterContacts([contact], 'example.test', role, [account])).toEqual([contact]);
    expect(filterLeads([lead], 'example.test', role)).toEqual([lead]);
  });

  it('does not match Viewer email or phone, but keeps name and company matches', () => {
    for (const term of ['example.test', '987654']) {
      expect(filterContacts([contact], term, 'viewer', [account])).toEqual([]);
      expect(filterLeads([lead], term, 'viewer')).toEqual([]);
    }
    expect(filterAccounts([account], '987654', 'viewer')).toEqual([]);
    expect(filterContacts([contact], 'aurora', 'viewer', [account])).toEqual([contact]);
    expect(filterLeads([lead], 'meera', 'viewer')).toEqual([lead]);
  });

  it('does not treat mixed text or one digit as a phone query', () => {
    for (const term of ['987x654', '9']) {
      expect(filterContacts([contact], term, 'rep', [account])).toEqual([]);
      expect(filterAccounts([account], term, 'rep')).toEqual([]);
      expect(filterLeads([lead], term, 'rep')).toEqual([]);
    }
  });

  it('excludes converted Leads for an active search and preserves the unfiltered list', () => {
    const converted: Lead = { ...lead, status: 'Converted' };
    expect(filterLeads([lead, converted], 'aurora', 'rep')).toEqual([lead]);
    expect(filterLeads([lead, converted], '', 'rep')).toEqual([lead, converted]);
  });
});
