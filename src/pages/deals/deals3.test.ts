import { describe, expect, it } from 'vitest';
import { Deal } from '../../types';
import {
  buildStages, bubbleSize, chanceAfterMove, daysUntil, dueInfo, filterPipeline, forecastBuckets, forecastMonth, historyLines, matchesClose,
  placeCards, runwayX, stageKind, stageOf,
} from './dealLogic';

const NOW = new Date(2026, 10, 17, 10, 0);
const day = (offset: number) => new Date(2026, 10, 17 + offset, 9, 0).toISOString();
const deal = (over: Partial<Deal>): Deal => ({
  id: 'd0', name: 'Deal', accountId: null, amount: 1000, stage: 'Qualification', closeDate: day(30), probability: 20, ownerId: 'u1', createdAt: day(-40), ...over,
});
const standard = buildStages(['Qualification', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost']);

describe('stages come from the bank’s list', () => {
  it('reads won, lost and open from the stage name', () => {
    expect(stageKind('Closed Won')).toBe('won');
    expect(stageKind('Closed - Won (signed)')).toBe('won');
    expect(stageKind('Closed Lost')).toBe('lost');
    expect(stageKind('Closed, no decision')).toBe('lost');
    expect(stageKind('Credit Review')).toBe('open');
  });

  it('keeps the bank’s order and gives its own stages a colour and a spread-out chance', () => {
    const stages = buildStages(['Qualification', 'KYC Check', 'Proposal', 'Credit Review', 'Negotiation', 'Closed Won', 'Closed Lost', 'Proposal']);
    expect(stages.map((s) => s.name)).toEqual(['Qualification', 'KYC Check', 'Proposal', 'Credit Review', 'Negotiation', 'Closed Won', 'Closed Lost']);
    expect(stageOf(stages, 'Proposal').chance).toBe(50);
    expect(stageOf(stages, 'KYC Check').chance).toBe(30);
    expect(stageOf(stages, 'Credit Review').chance).toBe(70);
    expect(stageOf(stages, 'KYC Check').hue).toMatch(/^#/);
    expect(stageOf(stages, 'Closed Won').chance).toBe(100);
  });

  it('still describes a stage the bank has since removed', () => {
    expect(stageOf(standard, 'Old stage').kind).toBe('open');
  });
});

describe('chance to win after a move', () => {
  it('follows the stage while it matches a stage default', () => {
    expect(chanceAfterMove(deal({ probability: 20 }), stageOf(standard, 'Proposal'), standard)).toBe(50);
  });
  it('keeps a chance set by hand', () => {
    expect(chanceAfterMove(deal({ probability: 35 }), stageOf(standard, 'Proposal'), standard)).toBe(35);
  });
  it('is 100 when won, 0 when lost, and the stage default when reopened', () => {
    expect(chanceAfterMove(deal({ probability: 35 }), stageOf(standard, 'Closed Won'), standard)).toBe(100);
    expect(chanceAfterMove(deal({ probability: 35 }), stageOf(standard, 'Closed Lost'), standard)).toBe(0);
    expect(chanceAfterMove(deal({ stage: 'Closed Lost', probability: 0 }), stageOf(standard, 'Negotiation'), standard)).toBe(75);
  });
});

describe('close dates', () => {
  it('counts whole calendar days', () => {
    expect(daysUntil(day(0), NOW)).toBe(0);
    expect(daysUntil(day(-3), NOW)).toBe(-3);
    expect(daysUntil(day(11), NOW)).toBe(11);
  });

  it('marks overdue, soon and later', () => {
    expect(dueInfo(deal({ closeDate: day(-6) }), NOW)).toMatchObject({ text: '6 days overdue', tone: 'late' });
    expect(dueInfo(deal({ closeDate: day(1) }), NOW)).toMatchObject({ text: 'Closes in 1 day', tone: 'soon' });
    expect(dueInfo(deal({ closeDate: day(40) }), NOW).tone).toBe('');
    expect(dueInfo(deal({ stage: 'Closed Won', closeDate: day(0) }), NOW).text).toBe('Won today');
  });

  it('filters by close date for open deals only', () => {
    expect(matchesClose(deal({ closeDate: day(-2) }), 'late', NOW)).toBe(true);
    expect(matchesClose(deal({ stage: 'Closed Won', closeDate: day(-2) }), 'late', NOW)).toBe(false);
    expect(matchesClose(deal({ closeDate: day(20) }), 'd30', NOW)).toBe(true);
    expect(matchesClose(deal({ closeDate: day(60) }), 'd30', NOW)).toBe(false);
    expect(matchesClose(deal({ closeDate: day(60) }), 'd90', NOW)).toBe(true);
  });
});

describe('pipeline filters', () => {
  const deals = [
    deal({ id: 'a', name: 'Fleet line', accountId: 'acc1', ownerId: 'u1' }),
    deal({ id: 'b', name: 'Escrow', accountId: 'acc2', ownerId: 'u2', closeDate: day(-1) }),
  ];
  const accountName = (id: string | null) => (id === 'acc2' ? 'Lumen Cloud' : 'Anand Motors');
  it('matches deal or account name, owner and close date together', () => {
    expect(filterPipeline(deals, { query: 'lumen', owners: [], close: 'any' }, accountName, NOW).map((d) => d.id)).toEqual(['b']);
    expect(filterPipeline(deals, { query: '', owners: ['u1'], close: 'any' }, accountName, NOW).map((d) => d.id)).toEqual(['a']);
    expect(filterPipeline(deals, { query: '', owners: [], close: 'late' }, accountName, NOW).map((d) => d.id)).toEqual(['b']);
  });
});

describe('forecast runway', () => {
  it('places close dates from 30 days ago to 120 days ahead', () => {
    expect(runwayX(-30)).toBe(0);
    expect(runwayX(-90)).toBe(0);
    expect(runwayX(0)).toBeCloseTo(0.2);
    expect(runwayX(500)).toBe(1);
  });

  it('sizes bubbles by area and keeps small ones clickable', () => {
    expect(bubbleSize(0, 1000)).toBe(16);
    expect(bubbleSize(1000, 1000)).toBe(62);
    expect(bubbleSize(250, 1000)).toBe(39);
  });

  it('groups open deals: overdue, this month and the next four, later', () => {
    const buckets = forecastBuckets([
      deal({ id: 'late', closeDate: day(-3) }),
      deal({ id: 'now', closeDate: day(5) }),
      deal({ id: 'far', closeDate: day(200) }),
      deal({ id: 'won', stage: 'Closed Won', closeDate: day(5) }),
    ], NOW);
    expect(buckets[0]).toMatchObject({ key: 'late', late: true });
    expect(buckets[0].deals.map((d) => d.id)).toEqual(['late']);
    expect(buckets[1].deals.map((d) => d.id)).toEqual(['now']);
    expect(buckets[buckets.length - 1]).toMatchObject({ key: 'later' });
    expect(buckets.flatMap((b) => b.deals).some((d) => d.id === 'won')).toBe(false);
  });

  it('names the month a deal counts toward', () => {
    expect(forecastMonth(day(20), 'Proposal', NOW)).toBe('December 2026');
    expect(forecastMonth(day(-1), 'Proposal', NOW)).toBe('Past close date');
    expect(forecastMonth(day(20), 'Closed Won', NOW)).toBe('Not forecast');
  });
});

describe('history', () => {
  it('reads newest first and names each kind of move', () => {
    const lines = historyLines(deal({
      stage: 'Negotiation',
      stageHistory: [
        { stage: 'Qualification', at: day(-30), by: 'Priya' },
        { stage: 'Proposal', at: day(-20), by: 'Priya' },
        { stage: 'Closed Lost', at: day(-10), by: 'Priya', note: 'Chose another bank' },
        { stage: 'Negotiation', at: day(-1), by: 'Sana' },
      ],
    }));
    expect(lines.map((l) => l.text)).toEqual(['Reopened in Negotiation', 'Closed as lost: Chose another bank', 'Moved to Proposal', 'Deal created in Qualification']);
    expect(lines[0].by).toBe('Sana');
  });

  it('shows one creation line for a deal saved before history existed', () => {
    expect(historyLines(deal({ stage: 'Proposal' })).map((l) => l.text)).toEqual(['Deal created in Proposal']);
  });
});

describe('record page cards', () => {
  it('puts History beside the side cards below the first, so it takes Quotes + Details height', () => {
    expect(placeCards(undefined)).toEqual([
      { id: 'nextStep', zone: 'main', row: '1', fill: false },
      { id: 'history', zone: 'main', row: '2 / 4', fill: true },
      { id: 'account', zone: 'side', row: '1', fill: false },
      { id: 'quotes', zone: 'side', row: '2', fill: false },
      { id: 'details', zone: 'side', row: '3', fill: false },
    ]);
  });

  it('lets History take the full side height when Next step is hidden (closed deals)', () => {
    expect(placeCards(undefined, ['nextStep']).find((c) => c.id === 'history')).toMatchObject({ row: '1 / 4', fill: true });
  });

  it('follows a layout’s own card list and ignores cards it does not know', () => {
    const placed = placeCards([{ id: 'details', zone: 'main' }, { id: 'mystery', zone: 'side' }, { id: 'quotes', zone: 'side' }]);
    expect(placed.map((c) => c.id)).toEqual(['details', 'quotes']);
    expect(placed[0]).toMatchObject({ row: '1 / 2', fill: true });
  });
});
