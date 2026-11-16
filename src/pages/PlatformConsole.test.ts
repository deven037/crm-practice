import { describe, expect, it } from 'vitest';
import { BankStatus, ConsoleBank } from '../data/frontDoor';
import { ACTIONS, filterBanks } from './PlatformConsole';
import { newPasswordProblems } from './SetPassword';

function bank(displayName: string, status: BankStatus, over: { legalName?: string; adminEmail?: string; emailDomains?: string[] } = {}): ConsoleBank {
  const slug = displayName.toLowerCase().replace(/[^a-z]/g, '');
  return {
    id: `bank-${slug}`,
    displayName,
    status,
    statusReason: null,
    adminEmail: over.adminEmail ?? `admin@${slug}.com`,
    profile: {
      legalName: over.legalName ?? `${displayName} Limited`, bankType: 'commercial', registrationNumber: 'REG-1', country: 'IN',
      address: '1 Bank Street', contactName: 'Asha Rao', contactPhone: '+91 22 5550 0100', contactEmail: `office@${slug}.com`,
      emailDomains: over.emailDomains ?? [`${slug}.com`], currency: 'INR', locale: 'en-IN', timezone: 'Asia/Kolkata', brandColor: '#1d3a6e',
      branches: 4, expectedUsers: 30, sampleData: false,
    },
    createdAt: '2026-11-15T10:00:00.000Z',
    updatedAt: '2026-11-15T10:00:00.000Z',
    decidedAt: null,
    assets: {},
    users: 1,
    records: 0,
  };
}

const BANKS = [
  bank('Axis Bank', 'active'),
  bank('Cedar Co-op', 'pending', { legalName: 'Cedar Urban Co-operative Bank Limited', adminEmail: 'ravi@cedarcoop.in', emailDomains: ['cedarcoop.in', 'cedar.bank'] }),
  bank('Quill Finance', 'rejected'),
  bank('Meridian Bank', 'suspended'),
  bank('Harbor Small Finance', 'pending'),
];
const names = (banks: ConsoleBank[]) => banks.map((b) => b.displayName);

describe('filterBanks', () => {
  it('shows every bank, in the order given, with no filter and no search', () => {
    expect(names(filterBanks(BANKS, 'all', ''))).toEqual(names(BANKS));
    expect(names(filterBanks(BANKS, 'all', '   '))).toEqual(names(BANKS));
  });

  it('filters by state', () => {
    expect(names(filterBanks(BANKS, 'pending', ''))).toEqual(['Cedar Co-op', 'Harbor Small Finance']);
    expect(names(filterBanks(BANKS, 'suspended', ''))).toEqual(['Meridian Bank']);
  });

  it('searches the name, legal name, admin email and email domains, in any letter case', () => {
    expect(names(filterBanks(BANKS, 'all', 'AXIS'))).toEqual(['Axis Bank']);
    expect(names(filterBanks(BANKS, 'all', 'urban co-operative'))).toEqual(['Cedar Co-op']);
    expect(names(filterBanks(BANKS, 'all', 'ravi@'))).toEqual(['Cedar Co-op']);
    expect(names(filterBanks(BANKS, 'all', 'cedar.bank'))).toEqual(['Cedar Co-op']);
  });

  it('applies the state and the search together', () => {
    expect(names(filterBanks(BANKS, 'pending', 'bank'))).toEqual(['Cedar Co-op']);
    expect(filterBanks(BANKS, 'active', 'cedar')).toEqual([]);
  });

  it('copes with a bank that has no admin email yet', () => {
    const odd = { ...bank('Odd Bank', 'pending'), adminEmail: undefined as unknown as string };
    expect(names(filterBanks([odd], 'all', 'odd'))).toEqual(['Odd Bank']);
    expect(filterBanks([odd], 'all', 'nobody@')).toEqual([]);
  });
});

describe('what the platform owner may do', () => {
  it('offers only the moves that make sense in each state', () => {
    expect(ACTIONS.pending).toEqual(['approve', 'reject']);
    expect(ACTIONS.active).toEqual(['suspend']);
    expect(ACTIONS.suspended).toEqual(['reactivate']);
    expect(ACTIONS.rejected).toEqual(['approve']);
  });
});

describe('newPasswordProblems', () => {
  it('finds nothing wrong with a good new password typed twice', () => {
    expect(newPasswordProblems('Temp-pass-1', 'Harbor-2026', 'Harbor-2026')).toEqual({});
  });

  it('asks for the current password', () => {
    expect(newPasswordProblems('', 'Harbor-2026', 'Harbor-2026').current).toBeDefined();
  });

  it('applies the password rules to the new one', () => {
    expect(newPasswordProblems('Temp-pass-1', 'short1', 'short1').next).toMatch(/8 characters/);
    expect(newPasswordProblems('Temp-pass-1', '12345678', '12345678').next).toMatch(/letter and a number/);
  });

  it('refuses the password that is being replaced', () => {
    expect(newPasswordProblems('Temp-pass-1', 'Temp-pass-1', 'Temp-pass-1').next).toMatch(/not just used/);
  });

  it('asks for the same new password twice', () => {
    expect(newPasswordProblems('Temp-pass-1', 'Harbor-2026', 'Harbor-2027')).toEqual({ confirm: 'The two passwords do not match.' });
  });
});
