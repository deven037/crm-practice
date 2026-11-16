import { describe, expect, it } from 'vitest';
import { ConsoleBank } from '../data/frontDoor';
import { formatBytes, resetPlan, storageLevel } from './PlatformConsole';
import { showsDemoReset } from './Settings';

function bank(id: string, displayName: string, keep = false, status: ConsoleBank['status'] = 'active'): ConsoleBank {
  return {
    id, displayName, status, statusReason: null, adminEmail: `admin@${id}.test`, keep,
    profile: {
      legalName: `${displayName} Limited`, bankType: 'commercial', registrationNumber: 'REG-1', country: 'IN', address: '1 Bank Street',
      contactName: 'Asha Rao', contactPhone: '+91 22 5550 0100', contactEmail: `office@${id}.test`, emailDomains: [`${id}.test`],
      currency: 'INR', locale: 'en-IN', timezone: 'Asia/Kolkata', brandColor: '#1d3a6e', branches: 1, expectedUsers: 5, sampleData: false,
    },
    createdAt: '2026-11-16T10:00:00.000Z', updatedAt: '2026-11-16T10:00:00.000Z', decidedAt: null, assets: {}, users: 1, records: 26,
  };
}
const names = (banks: ConsoleBank[]) => banks.map((b) => b.displayName);

describe('resetPlan', () => {
  const banks = [
    bank('bank-demo', 'Harbor Demo Bank'),
    bank('bank-axis', 'Axis Bank', true),
    bank('bank-test1', 'Test One'),
    bank('bank-test2', 'Test Two', false, 'pending'),
    bank('bank-test3', 'Test Three', false, 'rejected'),
  ];

  it('removes every bank that is not kept, whatever its state', () => {
    expect(names(resetPlan(banks).removed)).toEqual(['Test One', 'Test Two', 'Test Three']);
  });

  it('keeps the banks marked Keep', () => {
    expect(names(resetPlan(banks).kept)).toEqual(['Harbor Demo Bank', 'Axis Bank']);
  });

  it('always keeps the demo bank, even if its Keep mark is missing', () => {
    const plan = resetPlan([bank('bank-demo', 'Harbor Demo Bank', false)]);
    expect(names(plan.kept)).toEqual(['Harbor Demo Bank']);
    expect(plan.removed).toEqual([]);
  });

  it('puts every bank in exactly one list', () => {
    const plan = resetPlan(banks);
    expect(plan.removed.length + plan.kept.length).toBe(banks.length);
    expect(resetPlan([])).toEqual({ removed: [], kept: [] });
  });
});

describe('storageLevel', () => {
  const MB = 1024 * 1024;

  it('gives a whole percentage of the limit', () => {
    expect(storageLevel(128 * MB, 512 * MB)).toEqual({ percent: 25, warn: false });
    expect(storageLevel(0, 512 * MB)).toEqual({ percent: 0, warn: false });
  });

  it('warns from 80%', () => {
    expect(storageLevel(409 * MB, 512 * MB).warn).toBe(false);
    expect(storageLevel(409.6 * MB, 512 * MB).warn).toBe(true);
    expect(storageLevel(500 * MB, 512 * MB)).toEqual({ percent: 98, warn: true });
  });

  it('never shows more than 100%, and copes with a missing limit', () => {
    expect(storageLevel(900 * MB, 512 * MB)).toEqual({ percent: 100, warn: true });
    expect(storageLevel(5 * MB, 0)).toEqual({ percent: 0, warn: false });
    expect(storageLevel(-1, 512 * MB)).toEqual({ percent: 0, warn: false });
  });
});

describe('formatBytes', () => {
  it('uses the largest unit that fits', () => {
    expect(formatBytes(0)).toBe('0 bytes');
    expect(formatBytes(900)).toBe('900 bytes');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(38.42 * 1024 * 1024)).toBe('38.4 MB');
    expect(formatBytes(512 * 1024 * 1024)).toBe('512 MB');
    expect(formatBytes(1.5 * 1024 ** 3)).toBe('1.5 GB');
  });
});

describe('the Settings reset button', () => {
  it('is for the demo bank only', () => {
    expect(showsDemoReset({ id: 'bank-demo' })).toBe(true);
    expect(showsDemoReset({ id: 'bank-axis' })).toBe(false);
  });

  it('stays for an older demo session that remembers no bank', () => {
    expect(showsDemoReset(null)).toBe(true);
  });
});
