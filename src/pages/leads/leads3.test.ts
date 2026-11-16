import { describe, expect, it, vi } from 'vitest';

vi.mock('../../components/Modal', () => ({ Modal: () => null }));
vi.mock('../../components/Select', () => ({ SearchableSelect: () => null, Select: () => null }));

import { conversionSummary, CONVERT_STEPS, WizardState } from './LeadConvertWizard';
import { triageProgress } from '../../components/LeadTriageMode';
import { Lead } from '../../types';

const lead: Lead = {
  id: 'l1', name: 'Tara Iyer', company: 'Harbor', email: 'tara@example.com', phone: '123',
  status: 'New', source: 'Web', ownerId: 'u1', value: 100, createdAt: '',
};
const wizard: WizardState = {
  lead, step: 4, contactName: 'Tara Iyer', contactEmail: lead.email, contactPhone: lead.phone,
  accountMode: 'new', accountName: 'Harbor Ltd', existingAccountId: '', createDeal: false,
  dealName: 'Harbor New Business', dealAmount: 100, dealStage: 'Qualification',
};

describe('convert lead review', () => {
  it('ends on a Review step', () => {
    expect(CONVERT_STEPS).toEqual(['Contact', 'Account', 'Deal', 'Review']);
  });

  it('lists a new account and no deal when none is asked for', () => {
    expect(conversionSummary(wizard, [])).toEqual({ contact: 'Tara Iyer', account: 'Harbor Ltd', accountIsNew: true, deal: null });
  });

  it('names the existing account that was picked and includes the deal', () => {
    const summary = conversionSummary(
      { ...wizard, accountMode: 'existing', existingAccountId: 'a9', createDeal: true },
      [{ id: 'a9', name: 'Verma Textiles' }],
    );
    expect(summary).toEqual({ contact: 'Tara Iyer', account: 'Verma Textiles', accountIsNew: false, deal: { name: 'Harbor New Business', amount: 100 } });
  });

  it('falls back to the lead company when the new account has no name', () => {
    expect(conversionSummary({ ...wizard, accountName: '' }, []).account).toBe('Harbor');
  });
});

describe('triage progress', () => {
  it('goes from empty to full across the queue', () => {
    expect(triageProgress(0, 4)).toBe(0);
    expect(triageProgress(1, 4)).toBe(25);
    expect(triageProgress(4, 4)).toBe(100);
  });

  it('is full for an empty queue and never leaves 0 to 100', () => {
    expect(triageProgress(0, 0)).toBe(100);
    expect(triageProgress(9, 4)).toBe(100);
    expect(triageProgress(-2, 4)).toBe(0);
  });
});
