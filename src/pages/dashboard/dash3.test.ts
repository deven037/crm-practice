import { describe, expect, it, vi } from 'vitest';

vi.mock('../../data/store', () => ({
  getAllSync: () => [],
  bankProfileSync: () => ({ name: 'Harbor Bank', logoUrl: null, color: null, currency: 'INR', locale: 'en-IN' }),
}));

import { Campaign, Deal, Lead, Meeting, Quote, TaskItem, Ticket, User } from '../../types';
import { settingsOf } from '../quotes/quoteMath';
import {
  bandRows, buckets, cleanLayout, dayAgenda, DEFAULT_CARDS, inScope, monthOutcome, monthSeries, moveCard, needsFor, notSnoozed, periodPair, resized,
  rowsForHeight, spanWords, stageRiver, teamRows, waffle,
} from './dashLogic';
import { buildStages } from '../deals/dealLogic';

const DAY = 86_400_000;
const HOUR = 3_600_000;
const NOW = new Date(2026, 10, 19, 10, 0, 0).getTime();
const at = (ms: number) => new Date(NOW + ms).toISOString();
const me: User = { id: 'u1', name: 'Priya Nair', email: 'p@x', role: 'rep', active: true };
const admin: User = { id: 'u9', name: 'Asha Admin', email: 'a@x', role: 'admin', active: true };

const ticket = (id: string, leftH: number, extra: Partial<Ticket> = {}): Ticket => ({
  id, subject: `Ticket ${id}`, description: '', requester: 'Rhea', priority: 'High', status: 'Open', slaDue: at(leftH * HOUR), createdAt: at(-10 * HOUR),
  comments: [], attachments: [], ownerId: 'u1', ...extra,
});
const deal = (id: string, stage: string, amount: number, closeDays: number, extra: Partial<Deal> = {}): Deal => ({
  id, name: `Deal ${id}`, accountId: null, amount, stage, closeDate: at(closeDays * DAY), probability: 50, ownerId: 'u1', createdAt: at(-30 * DAY), ...extra,
} as Deal);
const task = (id: string, dueDays: number, extra: Partial<TaskItem> = {}): TaskItem => ({ id, title: `Task ${id}`, dueDate: at(dueDays * DAY), priority: 'High', completed: false, order: 0, ownerId: 'u1', ...extra });
const meeting = (id: string, inMin: number, notes = ''): Meeting => ({
  id, title: `Meeting ${id}`, type: 'Meeting', start: at(inMin * 60_000), durationMin: 30, ownerId: 'u1', attendeeIds: ['u1'], contactIds: [], location: '', reminder: '', notes, createdAt: at(-DAY),
});
const empty = { tickets: [], quotes: [], meetings: [], tasks: [], deals: [], leads: [], campaigns: [], accounts: [], users: [me, admin], settings: settingsOf([]) };

describe('needs you', () => {
  it('collects late tickets, agenda-less meetings, overdue tasks and deals without a next step, most urgent first', () => {
    const items = needsFor({
      ...empty,
      tickets: [ticket('t1', 3), ticket('t2', -1), ticket('t3', 9), ticket('t4', 1, { status: 'Resolved' }), ticket('t5', 1, { pausedAt: at(-HOUR) })],
      meetings: [meeting('m1', 45), meeting('m2', 45, 'Agenda: rates'), meeting('m3', 300)],
      tasks: [task('k1', -2), task('k2', 0), task('k3', -1, { completed: true })],
      deals: [deal('d1', 'Proposal', 10, 5), deal('d2', 'Proposal', 10, 5, { nextStep: 'Send rates' }), deal('d3', 'Proposal', 10, 40), deal('d4', 'Closed Won', 10, 2)],
    }, me, 'mine', NOW);
    expect(items.map((i) => i.key)).toEqual(['ticket:t2', 'meeting:m1', 'task:k1', 'ticket:t1', 'deal:d1']);
    expect(items[0].why).toBe('SLA breached 1 h ago');
    expect(items[0].hot).toBe(true);
    expect(items.find((i) => i.kind === 'task')!.taskId).toBe('k1');
  });

  it('keeps to my records on My work and shows everyone’s on Whole bank', () => {
    const input = { ...empty, tickets: [ticket('t1', 1), ticket('t2', 1, { ownerId: 'u2' })] };
    expect(needsFor(input, me, 'mine', NOW).map((i) => i.key)).toEqual(['ticket:t1']);
    expect(needsFor(input, me, 'bank', NOW)).toHaveLength(2);
    expect(inScope('mine', 'u1', null)).toBe(true);
  });

  it('asks for discount approvals only from the approver', () => {
    const q: Quote = { id: 'q1', quoteNumber: 'Q-1', accountId: 'a', lineItems: [{ id: 'l', productId: 'p', productName: 'P', quantity: 1, unitPrice: 100, discountPct: 20 }], status: 'Draft', validUntil: at(DAY), createdAt: at(-DAY), approval: 'waiting', ownerId: 'u1' };
    expect(needsFor({ ...empty, quotes: [q] }, me, 'bank', NOW)).toHaveLength(0);
    const asked = needsFor({ ...empty, quotes: [q] }, admin, 'bank', NOW);
    expect(asked[0].title).toBe('Quote Q-1 asks 20% off');
  });

  it('flags campaigns spending well ahead of their run', () => {
    const c: Campaign = { id: 'c1', name: 'POS push', channel: 'Email', budget: 100, startDate: at(-10 * DAY), endDate: at(30 * DAY), status: 'Active', createdAt: at(-20 * DAY), spent: 70, ownerId: 'u1' };
    expect(needsFor({ ...empty, campaigns: [c] }, me, 'mine', NOW)[0].why).toMatch(/^70% of the budget gone at \d+% of the run$/);
    expect(needsFor({ ...empty, campaigns: [{ ...c, spent: 20 }] }, me, 'mine', NOW)).toHaveLength(0);
  });

  it('hides snoozed items until the snooze runs out', () => {
    const items = needsFor({ ...empty, tickets: [ticket('t1', 1), ticket('t2', 2)] }, me, 'mine', NOW);
    expect(notSnoozed(items, { 'ticket:t1': NOW + HOUR }, NOW).map((i) => i.key)).toEqual(['ticket:t2']);
    expect(notSnoozed(items, { 'ticket:t1': NOW - 1 }, NOW)).toHaveLength(2);
    expect(spanWords(25 * 60_000)).toBe('25 min');
    expect(spanWords(3 * DAY)).toBe('3 days');
  });
});

describe('figures', () => {
  it('adds up won value by day this month and last, with a fan from open deals closing this month', () => {
    const now = new Date(2026, 10, 19, 12).getTime();
    const d = (id: string, stage: string, amount: number, date: Date, prob = 50) => deal(id, stage, amount, 0, { closeDate: date.toISOString(), probability: prob });
    const m = monthSeries([
      d('a', 'Closed Won', 100, new Date(2026, 10, 3)), d('b', 'Closed Won', 50, new Date(2026, 10, 18)), d('c', 'Closed Won', 70, new Date(2026, 9, 10)),
      d('e', 'Proposal', 200, new Date(2026, 10, 25), 25), d('f', 'Proposal', 999, new Date(2026, 11, 5)), d('g', 'Closed Lost', 500, new Date(2026, 10, 5)),
    ], 'bank', undefined, now);
    expect(m.days).toBe(30);
    expect(m.thisMonth).toHaveLength(19);
    expect(m.won).toBe(150);
    expect(m.wonDeals).toBe(2);
    expect(m.lastAtToday).toBe(70);
    expect(m.lastMonth).toHaveLength(31);
    expect(m.expected).toBe(200);
    expect(m.best).toBe(350);
  });

  it('compares a period with the one before and spreads it into buckets', () => {
    const items = [-1, -2, -9, -40].map((d) => ({ at: NOW + d * DAY, v: 10 }));
    const p = periodPair(items, 7, (x) => x.at, (x) => x.v, NOW);
    expect(p).toEqual({ current: 20, previous: 10, change: 1 });
    expect(buckets(items, 7, (x) => x.at, () => 1, NOW)).toEqual([0, 0, 0, 0, 0, 1, 1]);
    expect(buckets(items, 30, (x) => x.at, () => 1, NOW)).toHaveLength(12);
  });

  it('lists today’s meetings and timed tasks with the now line, and counts tasks with no time', () => {
    const day = dayAgenda([meeting('m1', -60), meeting('m2', 90), meeting('m3', 60 * 30)], [task('k1', 0, { dueTime: '15:00' }), task('k2', 0), task('k3', 1, { dueTime: '09:00' })], 'u1', NOW);
    expect(day.items.map((i) => i.key)).toEqual(['m-m1', 'm-m2', 't-k1']);
    expect(day.nowIndex).toBe(1);
    expect(day.untimed).toBe(1);
  });

  it('flows open deals by stage and finds the month’s wins, losses and top reason', () => {
    const stages = buildStages(['Qualification', 'Proposal', 'Closed Won', 'Closed Lost']);
    const list = [deal('a', 'Proposal', 30, 3), deal('b', 'Proposal', 20, 1), deal('c', 'Old stage', 5, 9), deal('d', 'Closed Lost', 7, -2, { lostReason: 'Price' })];
    const r = stageRiver(list, stages);
    expect(r.rows.map((x) => `${x.name}:${x.value}`)).toEqual(['Proposal:50', 'Old stage:5']);
    expect(r.closing[0].id).toBe('b');
    expect(monthOutcome(list, NOW)).toMatchObject({ lost: 7, lostCount: 1, topReason: 'Price' });
  });

  it('fills exactly 100 squares in status order', () => {
    const sq = waffle([{ name: 'New', count: 1 }, { name: 'Qualified', count: 1 }, { name: 'Lost', count: 1 }]);
    expect(sq).toHaveLength(100);
    expect(sq[0]).toBe('New');
    expect(sq.filter((s) => s === 'Lost').length).toBeGreaterThanOrEqual(33);
    expect(waffle([])).toEqual([]);
  });

  it('ranks the team by won this month and leaves viewers out', () => {
    const rows = teamRows([me, admin, { ...me, id: 'v', role: 'viewer' }], [deal('a', 'Closed Won', 40, -1, { ownerId: 'u9' }), deal('b', 'Proposal', 9, 5)], [task('k', 1)], [], NOW);
    expect(rows.map((r) => r.id)).toEqual(['u9', 'u1']);
    expect(rows[1]).toMatchObject({ open: 9, tasks: 1 });
  });
});

describe('layout', () => {
  it('cleans a saved layout: unknown and repeated cards go, sizes stay in the grid, new cards come back', () => {
    const out = cleanLayout([{ id: 'month', span: 40, rows: 2, hidden: false }, { id: 'nope', span: 4, rows: null, hidden: false }, { id: 'month', span: 4, rows: null, hidden: true }]);
    expect(out[0]).toEqual({ id: 'month', span: 12, rows: 8, hidden: false });
    expect(out.map((c) => c.id).sort()).toEqual(DEFAULT_CARDS.map((c) => c.id).sort());
    expect(cleanLayout(null)).toEqual(DEFAULT_CARDS);
  });

  it('moves a card before or after another', () => {
    const ids = (l: typeof DEFAULT_CARDS) => l.map((c) => c.id).join(',');
    expect(ids(moveCard(DEFAULT_CARDS, 'feed', 'needs', false))).toBe('feed,needs,month,pulse,day,pipe,team,leads');
    expect(ids(moveCard(DEFAULT_CARDS, 'needs', 'month', true))).toBe('month,needs,pulse,day,pipe,team,leads,feed');
  });

  it('resizes from an edge or the corner in whole columns and rows, never below the card’s minimum', () => {
    const card = { id: 'month', span: 7, rows: null, hidden: false };
    expect(resized(card, 'e', 160, 500, 80, 7, 10)).toEqual({ ...card, span: 9 });
    expect(resized(card, 'se', -800, -800, 80, 7, 10)).toEqual({ ...card, span: 4, rows: 8 });
    expect(resized(card, 's', 0, 68, 80, 7, 10)).toEqual({ ...card, rows: 12 });
    expect(rowsForHeight(20)).toBe(1);
    expect(rowsForHeight(54)).toBe(2);
  });

  it('gives cards in one row the tallest height unless someone sized them', () => {
    const cards = [{ id: 'needs', span: 5, rows: null, hidden: false }, { id: 'month', span: 7, rows: null, hidden: false }, { id: 'day', span: 4, rows: 6, hidden: false }, { id: 'pipe', span: 8, rows: null, hidden: false }];
    expect(bandRows(cards, { needs: 10, month: 14, pipe: 9 }, false)).toEqual({ needs: 14, month: 14, day: 6, pipe: 9 });
    expect(bandRows(cards, { needs: 10, month: 14, pipe: 9 }, true)).toEqual({ needs: 10, month: 14, day: 6, pipe: 9 });
  });
});
