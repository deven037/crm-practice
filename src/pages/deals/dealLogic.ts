import { Deal, DealStageEvent, RecordCard } from '../../types';

/*
 * Deals 3.0 logic with no React in it: stages, dates, the forecast and the record page cards.
 * Stage names come from the bank's settings (Setup, status codes), so nothing here lists them as fixed rules.
 */

export type StageKind = 'open' | 'won' | 'lost';

export interface StageInfo {
  name: string;
  kind: StageKind;
  /** Colour used on gates, cards, bubbles and the stage path. */
  hue: string;
  /** The chance to win a deal gets when it enters this stage, unless someone set it by hand. */
  chance: number;
}

const KNOWN: Record<string, { hue: string; chance: number }> = {
  qualification: { hue: '#2f6fe0', chance: 20 },
  proposal: { hue: '#c98a12', chance: 50 },
  negotiation: { hue: '#6d4fd6', chance: 75 },
  'closed won': { hue: '#17936a', chance: 100 },
  'closed lost': { hue: '#8a93a6', chance: 0 },
};
const SPARE_HUES = ['#0f97a8', '#d1478d', '#d9642b', '#2f6fe0', '#c98a12', '#6d4fd6'];

/** A closed stage that mentions "won" is a win; any other closed stage is a loss; everything else is open. */
export function stageKind(name: string): StageKind {
  if (!/^closed\b/i.test(name.trim())) return 'open';
  return /\bwon\b/i.test(name) ? 'won' : 'lost';
}

export const isOpenStage = (name: string) => stageKind(name) === 'open';

function hueFor(name: string): string {
  const known = KNOWN[name.trim().toLowerCase()];
  if (known) return known.hue;
  let n = 0;
  for (const ch of name.toLowerCase()) n = (n * 31 + ch.charCodeAt(0)) >>> 0;
  return SPARE_HUES[n % SPARE_HUES.length];
}

/**
 * The bank's stage list, in its order, with a kind, colour and default chance for each.
 * Open stages the bank added itself get a chance spread evenly between 10% and 90% by their position.
 */
export function buildStages(names: string[]): StageInfo[] {
  const unique = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  const open = unique.filter(isOpenStage);
  return unique.map((name) => {
    const kind = stageKind(name);
    const known = KNOWN[name.toLowerCase()];
    const spread = open.length > 1 ? 10 + Math.round(((open.indexOf(name) / (open.length - 1)) * 80) / 5) * 5 : 50;
    const chance = kind === 'won' ? 100 : kind === 'lost' ? 0 : known ? known.chance : spread;
    return { name, kind, hue: hueFor(name), chance };
  });
}

/** Stage info for any name, including a stage that was later removed from the bank's list. */
export function stageOf(stages: StageInfo[], name: string): StageInfo {
  return stages.find((s) => s.name === name) ?? buildStages([name])[0];
}

/** The chance a deal should have after moving to `target`. A chance someone set by hand is kept. */
export function chanceAfterMove(deal: Pick<Deal, 'stage' | 'probability'>, target: StageInfo, stages: StageInfo[]): number {
  if (target.kind === 'won') return 100;
  if (target.kind === 'lost') return 0;
  const reopening = !isOpenStage(deal.stage);
  const followsStage = stages.some((s) => s.kind === 'open' && s.chance === deal.probability);
  return reopening || followsStage ? target.chance : deal.probability;
}

// ---------- dates ----------

const DAY = 24 * 60 * 60 * 1000;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** Whole calendar days from today to the date (negative when it has passed). */
export function daysUntil(iso: string, now: Date = new Date()): number {
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return 0;
  return Math.round((startOfDay(t) - startOfDay(now)) / DAY);
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const shortDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const longDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

export interface DueInfo {
  text: string;
  short: string;
  tone: '' | 'soon' | 'late';
}

/** How the close date reads on a card: overdue in red, the next two weeks in amber. */
export function dueInfo(deal: Pick<Deal, 'stage' | 'closeDate'>, now: Date = new Date()): DueInfo {
  const kind = stageKind(deal.stage);
  const n = daysUntil(deal.closeDate, now);
  if (!deal.closeDate) return { text: 'No close date', short: 'No date', tone: '' };
  if (kind !== 'open') {
    const word = kind === 'won' ? 'Won' : 'Lost';
    return { text: `${word} ${n === 0 ? 'today' : longDate(deal.closeDate)}`, short: word, tone: '' };
  }
  if (n < 0) return { text: `${plural(-n, 'day')} overdue`, short: `${plural(-n, 'day')} late`, tone: 'late' };
  if (n === 0) return { text: 'Closes today', short: 'Today', tone: 'soon' };
  if (n <= 14) return { text: `Closes in ${plural(n, 'day')}`, short: `In ${plural(n, 'day')}`, tone: 'soon' };
  return { text: `Closes ${longDate(deal.closeDate)}`, short: shortDate(deal.closeDate), tone: '' };
}

// ---------- money and filters ----------

export const total = (deals: Pick<Deal, 'amount'>[]) => deals.reduce((sum, d) => sum + (d.amount || 0), 0);
export const weighted = (deals: Pick<Deal, 'amount' | 'probability'>[]) => deals.reduce((sum, d) => sum + ((d.amount || 0) * (d.probability || 0)) / 100, 0);

export type CloseFilter = 'any' | 'late' | 'd30' | 'd90';
export const CLOSE_FILTERS: { value: CloseFilter; label: string }[] = [
  { value: 'any', label: 'Any close date' },
  { value: 'late', label: 'Overdue' },
  { value: 'd30', label: 'Next 30 days' },
  { value: 'd90', label: 'Next 90 days' },
];

export function matchesClose(deal: Pick<Deal, 'stage' | 'closeDate'>, filter: CloseFilter, now: Date = new Date()): boolean {
  if (filter === 'any') return true;
  if (!isOpenStage(deal.stage)) return false;
  const n = daysUntil(deal.closeDate, now);
  return filter === 'late' ? n < 0 : n >= 0 && n <= (filter === 'd30' ? 30 : 90);
}

export interface DealFilter {
  query: string;
  owners: string[];
  close: CloseFilter;
}

export function filterPipeline(deals: Deal[], filter: DealFilter, accountName: (id: string | null) => string, now: Date = new Date()): Deal[] {
  const q = filter.query.trim().toLowerCase();
  return deals.filter((d) =>
    (!q || d.name.toLowerCase().includes(q) || accountName(d.accountId).toLowerCase().includes(q)) &&
    (!filter.owners.length || filter.owners.includes(d.ownerId)) &&
    matchesClose(d, filter.close, now));
}

// ---------- forecast runway ----------

export const RUNWAY_FROM = -30;
export const RUNWAY_TO = 120;

/** Where a close date sits across the runway, from 0 (30 days ago or earlier) to 1 (120 days ahead or later). */
export function runwayX(days: number): number {
  return (Math.max(RUNWAY_FROM, Math.min(RUNWAY_TO, days)) - RUNWAY_FROM) / (RUNWAY_TO - RUNWAY_FROM);
}

/** Bubble diameter in pixels: area follows the amount, with a floor so small deals stay clickable. */
export function bubbleSize(amount: number, largest: number, min = 16, spread = 46): number {
  return Math.round(min + spread * Math.sqrt(Math.max(0, amount) / Math.max(1, largest)));
}

export interface ForecastBucket {
  key: string;
  label: string;
  deals: Deal[];
  late?: boolean;
}

/** Open deals grouped by close month: overdue first, then this month and the next four, then anything later. */
export function forecastBuckets(deals: Deal[], now: Date = new Date()): ForecastBucket[] {
  const open = deals.filter((d) => isOpenStage(d.stage));
  const monthIndex = (iso: string) => { const d = new Date(iso); return d.getFullYear() * 12 + d.getMonth(); };
  const first = now.getFullYear() * 12 + now.getMonth();
  const late = open.filter((d) => daysUntil(d.closeDate, now) < 0);
  const upcoming = open.filter((d) => daysUntil(d.closeDate, now) >= 0);
  const buckets: ForecastBucket[] = [];
  if (late.length) buckets.push({ key: 'late', label: 'Past close date', deals: late, late: true });
  for (let m = 0; m < 5; m++) {
    const key = first + m;
    const label = new Date(Math.floor(key / 12), key % 12, 1).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
    buckets.push({ key: String(key), label, deals: upcoming.filter((d) => monthIndex(d.closeDate) === key) });
  }
  const later = upcoming.filter((d) => monthIndex(d.closeDate) > first + 4);
  if (later.length) buckets.push({ key: 'later', label: 'Later', deals: later });
  return buckets;
}

/** The month a close date counts toward, as words. */
export function forecastMonth(iso: string, stage: string, now: Date = new Date()): string {
  if (!isOpenStage(stage)) return 'Not forecast';
  if (!iso) return 'No close date';
  if (daysUntil(iso, now) < 0) return 'Past close date';
  return new Date(iso).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

// ---------- stage history ----------

export interface HistoryLine {
  text: string;
  stage: string;
  at: string;
  by: string;
}

/** The history card, newest first. A deal saved before history existed shows one line for its creation. */
export function historyLines(deal: Pick<Deal, 'stage' | 'createdAt' | 'stageHistory'>): HistoryLine[] {
  const events: DealStageEvent[] = deal.stageHistory?.length ? deal.stageHistory : [{ stage: deal.stage, at: deal.createdAt, by: '' }];
  return events.map((e, i) => {
    const kind = stageKind(e.stage);
    const before = i > 0 ? events[i - 1].stage : null;
    const text = i === 0 ? `Deal created in ${e.stage}`
      : kind === 'won' ? 'Closed as won'
      : kind === 'lost' ? `Closed as lost${e.note ? `: ${e.note}` : ''}`
      : before && !isOpenStage(before) ? `Reopened in ${e.stage}`
      : `Moved to ${e.stage}`;
    return { text, stage: e.stage, at: e.at, by: e.by };
  }).reverse();
}

// ---------- record page cards ----------

export type DealCardId = 'nextStep' | 'history' | 'account' | 'quotes' | 'details';
export const DEAL_CARD_IDS: DealCardId[] = ['nextStep', 'history', 'account', 'quotes', 'details'];

/** The deal page as it comes: next step and history on the left, account, quotes and details on the right. */
export const DEFAULT_DEAL_CARDS: RecordCard[] = [
  { id: 'nextStep', zone: 'main' },
  { id: 'history', zone: 'main' },
  { id: 'account', zone: 'side' },
  { id: 'quotes', zone: 'side' },
  { id: 'details', zone: 'side' },
];

export interface PlacedCard {
  id: DealCardId;
  zone: 'main' | 'side';
  /** CSS grid-row value on wide screens, so the last main card fills down beside the side column. */
  row: string;
  /** The last card in the main column stretches to the side column's height and scrolls inside. */
  fill: boolean;
}

/**
 * Lays the record page's cards out on two columns. The last card of the main column (History, as standard)
 * starts level with a side card and takes the height of every side card from there down, so it never grows
 * longer than its neighbours: new entries scroll inside it.
 */
export function placeCards(cards: RecordCard[] | undefined, hide: DealCardId[] = []): PlacedCard[] {
  const list = (cards?.length ? cards : DEFAULT_DEAL_CARDS)
    .filter((c): c is RecordCard & { id: DealCardId } => (DEAL_CARD_IDS as string[]).includes(c.id) && !hide.includes(c.id as DealCardId));
  const main = list.filter((c) => c.zone === 'main');
  const side = list.filter((c) => c.zone !== 'main');
  const placed: PlacedCard[] = [];
  main.forEach((c, i) => {
    const last = i === main.length - 1;
    const fill = last && side.length > i;
    placed.push({ id: c.id, zone: 'main', row: fill ? `${i + 1} / ${side.length + 1}` : `${i + 1}`, fill });
  });
  side.forEach((c, i) => placed.push({ id: c.id, zone: 'side', row: `${i + 1}`, fill: false }));
  return placed;
}
