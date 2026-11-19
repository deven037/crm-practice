import { describe, expect, it, vi } from 'vitest';

vi.mock('../../data/store', () => ({
  getAllSync: () => [],
  bankProfileSync: () => ({ name: 'Harbor Bank', logoUrl: null, color: null, currency: 'INR', locale: 'en-IN' }),
}));

import { Campaign, Deal, Lead } from '../../types';
import {
  averageCpl, channelHue, dayIso, dayOffset, daysFromInput, expectedSpend, inputDate, matchesCampaign, overlapping, paceText, pctOn,
  roiText, roiTone, runWindow, statsFor, stoppedAt, totals, weeksOf,
} from './campaignLogic';

const DAY = 86_400_000;
const NOW = new Date(2026, 10, 18, 10, 0, 0).getTime();
const at = (days: number, end = false) => dayIso(days, end, NOW);
const campaign = (id: string, s: number, e: number, extra: Partial<Campaign> = {}): Campaign => ({
  id, name: `Campaign ${id}`, channel: 'Email', budget: 100_000, startDate: at(s), endDate: at(e, true), status: 'Active', createdAt: at(s - 10), spent: 0, ...extra,
});
const lead = (id: string, campaignId: string | null, days: number, status: Lead['status'] = 'New'): Lead => ({
  id, name: `Lead ${id}`, company: 'Kapoor Exports', email: '', phone: '', status, source: 'Web', ownerId: 'user-1', value: 1, createdAt: new Date(NOW + days * DAY).toISOString(), campaignId,
});
const deal = (id: string, campaignId: string, stage: string, amount: number): Deal => ({
  id, name: id, accountId: null, amount, stage, closeDate: at(5), probability: 50, ownerId: 'user-1', createdAt: at(-5), campaignId,
} as Deal);

describe('campaign figures', () => {
  const c = campaign('c1', -20, 20, { spent: 40_000, targetLeads: 50 });
  const leads = [lead('1', 'c1', -15), lead('2', 'c1', -8, 'Contacted'), lead('3', 'c1', -1, 'Qualified'), lead('4', 'c2', -1), lead('5', null, -1)];
  const deals = [deal('d1', 'c1', 'Proposal', 50_000), deal('d2', 'c1', 'Closed Won', 120_000), deal('d3', 'c2', 'Closed Won', 1)];

  it('counts leads, the ones followed up, deals and won value, with return and costs per lead', () => {
    const s = statsFor(c, leads, deals, 'New');
    expect(s.leads.map((l) => l.id)).toEqual(['1', '2', '3']);
    expect(s.reached.map((l) => l.id)).toEqual(['2', '3']);
    expect(s.deals).toHaveLength(2);
    expect(s.wonValue).toBe(120_000);
    expect(s.roi).toBe(3);
    expect(s.cpl).toBeCloseTo(40_000 / 3);
    expect(s.plannedCpl).toBe(2000);
    expect(roiText(s.roi)).toBe('3.0×');
    expect([roiTone(0.6), roiTone(3), roiTone(12), roiTone(null)]).toEqual(['lo', '', 'hi', '']);
  });

  it('gives no return or cost per lead before money is spent, and leaves planned campaigns out of the totals', () => {
    const fresh = statsFor(campaign('c9', 5, 30, { status: 'Planned', spent: 0 }), [], [], 'New');
    expect(fresh.roi).toBeNull();
    expect(fresh.cpl).toBeNull();
    expect(fresh.plannedCpl).toBeNull();
    const list = [c, campaign('c9', 5, 30, { status: 'Planned', budget: 60_000 })];
    const map = new Map(list.map((x) => [x.id, statsFor(x, leads, deals, 'New')]));
    const t = totals(list, map);
    expect(t.live).toBe(1);
    expect(t.spent).toBe(40_000);
    expect(t.won).toBe(120_000);
    expect(t.budget).toBe(160_000);
    expect(t.planned).toBe(1);
  });

  it('finds the cost per lead for a channel, skipping the campaign being edited', () => {
    const a = campaign('a', -30, -5, { spent: 30_000, channel: 'Email', status: 'Completed' });
    const b = campaign('b', -30, -5, { spent: 10_000, channel: 'Webinar', status: 'Completed' });
    const ls = [lead('1', 'a', -20), lead('2', 'a', -20), lead('3', 'b', -20)];
    const map = new Map([a, b].map((x) => [x.id, statsFor(x, ls, [], 'New')]));
    expect(averageCpl([a, b], map, 'Email')).toBe(15_000);
    expect(averageCpl([a, b], map)).toBeCloseTo(40_000 / 3);
    expect(averageCpl([a, b], map, 'Email', 'a')).toBeNull();
  });
});

describe('pace and weeks', () => {
  it('expects spend in step with the days gone, and says ahead or behind', () => {
    const c = campaign('c1', -9, 10);
    expect(expectedSpend(c, NOW)).toBeCloseTo(0.5);
    expect(paceText(c, 0.5, NOW)).toBe('on plan');
    expect(paceText(c, 0.9, NOW)).toBe('ahead of plan');
    expect(paceText(c, 0.1, NOW)).toBe('behind plan');
    expect(expectedSpend({ ...c, status: 'Planned' }, NOW)).toBe(0);
    expect(expectedSpend({ ...c, status: 'Completed' }, NOW)).toBe(1);
    expect(paceText({ ...c, status: 'Completed' }, 0.1, NOW)).toBe('');
  });

  it('puts leads in the week they came, late ones in the last week gone, and leaves future weeks empty', () => {
    const c = campaign('c1', -10, 17);
    const w = weeksOf(c, [lead('1', 'c1', -30), lead('2', 'c1', -9), lead('3', 'c1', -2), lead('4', 'c1', 0)], NOW);
    expect(w.n).toBe(4);
    expect(w.done).toBe(2);
    expect(w.vals).toEqual([2, 2]);
    expect(weeksOf({ ...c, status: 'Planned' }, [], NOW).done).toBe(0);
  });

  it('stops a cancelled campaign’s weeks where it was cancelled', () => {
    const c = campaign('c1', -40, -1, { status: 'Cancelled', history: [{ at: at(-30), by: 'Asha', text: 'Cancelled: too costly' }] });
    expect(stoppedAt(c)).toBe(at(-30));
    expect(weeksOf(c, [lead('1', 'c1', -5)], NOW)).toMatchObject({ n: 6, done: 2, vals: [0, 1] });
  });
});

describe('dates and the runway', () => {
  it('turns days from today into dates and back', () => {
    expect(dayOffset(at(12), NOW)).toBe(12);
    expect(dayOffset(at(-3, true), NOW)).toBe(-3);
    expect(daysFromInput(inputDate(45, NOW), NOW)).toBe(45);
    expect(daysFromInput('not a date', NOW)).toBeNull();
    expect(new Date(at(2, true)).getHours()).toBe(23);
  });

  it('spans whole months around the campaigns and today, never more than a year either way', () => {
    const w = runWindow([campaign('a', -100, 20), campaign('b', 30, 900)], NOW);
    expect(new Date(w.from).getDate()).toBe(1);
    expect(w.from).toBeLessThanOrEqual(Date.parse(at(-100)));
    expect(w.to).toBeLessThanOrEqual(NOW + 400 * DAY);
    expect(w.months[0].at).toBe(w.from);
    expect(pctOn(w, w.from - DAY)).toBe(0);
    expect(pctOn(w, w.to + DAY)).toBe(100);
  });

  it('finds same-channel campaigns whose run crosses the plan, but not cancelled ones', () => {
    const list = [campaign('a', -5, 20), campaign('b', 30, 40), campaign('c', 0, 10, { status: 'Cancelled' }), campaign('d', 0, 10, { channel: 'Webinar' })];
    expect(overlapping(list, 'Email', 10, 25, null, NOW).map((c) => c.id)).toEqual(['a']);
    expect(overlapping(list, 'Email', 10, 25, 'a', NOW)).toEqual([]);
    expect(overlapping(list, '', 10, 25, null, NOW)).toEqual([]);
  });

  it('matches a search on name, channel, status or owner, and colours a bank’s own channel steadily', () => {
    const c = campaign('a', 0, 10, { name: 'Festive Business Loans', audience: 'Traders' });
    expect(matchesCampaign(c, 'festive')).toBe(true);
    expect(matchesCampaign(c, 'email')).toBe(true);
    expect(matchesCampaign(c, 'sam', 'Sam Sales')).toBe(true);
    expect(matchesCampaign(c, 'traders')).toBe(true);
    expect(matchesCampaign(c, 'webinar')).toBe(false);
    expect(channelHue('Email')).toBe('#2f6fe0');
    expect(channelHue('Branch Posters')).toBe(channelHue('Branch Posters'));
    expect(channelHue('Branch Posters')).toMatch(/^#/);
  });
});
