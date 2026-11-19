import { Campaign, CampaignStatus, CAMPAIGN_CHANNELS, CAMPAIGN_STATUSES, Deal, Lead, LEAD_STATUSES } from '../../types';
import { getStatusOptions } from '../../utils/rules';
import { stageKind } from '../deals/dealLogic';

export const DAY = 86_400_000;

/** The bank's channels (Setup → Status codes → Campaigns — Channel). */
export const campaignChannels = (): string[] => getStatusOptions('campaigns', 'channel', CAMPAIGN_CHANNELS);
export const STATUSES: CampaignStatus[] = CAMPAIGN_STATUSES;

const KNOWN_HUES: Record<string, string> = {
  Email: '#2f6fe0', 'Social Media': '#d9467a', Webinar: '#7a4fd6', 'Content Marketing': '#0f97a8',
  'Paid Search': '#d9642b', 'Trade Show': '#1f9d63', 'Partner Referral': '#b8860b',
};
const SPARE_HUES = ['#c2185b', '#3f51b5', '#00897b', '#8d6e63', '#5e35b1', '#ef6c00', '#546e7a', '#2e7d32'];

/** A steady colour per channel: the standard ones keep theirs, a bank's own channels get one from their name. */
export function channelHue(channel: string | undefined): string {
  if (!channel) return '#5b6b8a';
  if (KNOWN_HUES[channel]) return KNOWN_HUES[channel];
  let h = 0;
  for (const ch of channel) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return SPARE_HUES[h % SPARE_HUES.length];
}

export type ChannelIcon = 'mail' | 'share' | 'video' | 'book' | 'search' | 'tent' | 'hand' | 'mega';
const KNOWN_ICONS: Record<string, ChannelIcon> = {
  Email: 'mail', 'Social Media': 'share', Webinar: 'video', 'Content Marketing': 'book', 'Paid Search': 'search', 'Trade Show': 'tent', 'Partner Referral': 'hand',
};
export const channelIcon = (channel: string | undefined): ChannelIcon => (channel && KNOWN_ICONS[channel]) || 'mega';

export const STATUS_HUE: Record<CampaignStatus, string> = { Planned: '#8a93a6', Active: '#2f6fe0', Completed: '#1f9d63', Cancelled: '#c0392b' };
export const statusHue = (s: string) => STATUS_HUE[s as CampaignStatus] ?? '#8a93a6';

// ---- days ----
export const startOfDay = (ms: number) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };
/** Whole days from today to the date (negative: in the past). */
export const dayOffset = (iso: string, now = Date.now()) => Math.round((startOfDay(Date.parse(iso)) - startOfDay(now)) / DAY);
/** The date `days` from today: the start of that day, or its last minute for an end date. */
export function dayIso(days: number, end = false, now = Date.now()): string {
  const d = new Date(startOfDay(now));
  d.setDate(d.getDate() + days);
  if (end) d.setHours(23, 59, 0, 0);
  return d.toISOString();
}
/** yyyy-mm-dd in local time, for <input type="date">. */
export function inputDate(days: number, now = Date.now()): string {
  const d = new Date(dayIso(days, false, now));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function daysFromInput(value: string, now = Date.now()): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const at = new Date(+m[1], +m[2] - 1, +m[3]).getTime();
  return Math.round((at - startOfDay(now)) / DAY);
}
export const dayShort = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
/** Run length in days, counting both ends. */
export const runDays = (c: Pick<Campaign, 'startDate' | 'endDate'>) => Math.max(1, dayOffset(c.endDate) - dayOffset(c.startDate) + 1);

// ---- what a campaign brought ----
export interface CampaignStats {
  leads: Lead[];
  /** Leads past the bank's first lead status (contacted, qualified, converted or ruled out). */
  reached: Lead[];
  deals: Deal[];
  won: Deal[];
  wonValue: number;
  spent: number;
  /** Won value per rupee spent, or null before anything was spent. */
  roi: number | null;
  /** Spent per lead, or null with no leads. */
  cpl: number | null;
  /** Budget per lead wanted, or null with no goal. */
  plannedCpl: number | null;
}

export const firstLeadStatus = () => getStatusOptions('leads', 'status', LEAD_STATUSES)[0] ?? 'New';

export function statsFor(c: Campaign, leads: Lead[], deals: Deal[], fresh = firstLeadStatus()): CampaignStats {
  const own = leads.filter((l) => l.campaignId === c.id);
  const ownDeals = deals.filter((d) => d.campaignId === c.id);
  const won = ownDeals.filter((d) => stageKind(d.stage) === 'won');
  const wonValue = won.reduce((t, d) => t + (d.amount || 0), 0);
  const spent = c.spent ?? 0;
  return {
    leads: own,
    reached: own.filter((l) => l.status !== fresh),
    deals: ownDeals,
    won,
    wonValue,
    spent,
    roi: spent > 0 ? wonValue / spent : null,
    cpl: own.length && spent > 0 ? spent / own.length : null,
    plannedCpl: c.targetLeads && c.budget ? c.budget / c.targetLeads : null,
  };
}

/** Value per rupee spent across campaigns that have started. */
export function totals(campaigns: Campaign[], stats: Map<string, CampaignStats>) {
  const live = campaigns.filter((c) => c.status !== 'Planned');
  const sum = (f: (s: CampaignStats) => number) => live.reduce((t, c) => t + (stats.get(c.id) ? f(stats.get(c.id)!) : 0), 0);
  const spent = sum((s) => s.spent);
  const won = sum((s) => s.wonValue);
  const leads = sum((s) => s.leads.length);
  return {
    live: live.length,
    spent,
    won,
    leads,
    wonDeals: sum((s) => s.won.length),
    budget: campaigns.reduce((t, c) => t + (c.budget || 0), 0),
    roi: spent > 0 ? won / spent : null,
    cpl: leads && spent ? spent / leads : null,
    running: campaigns.filter((c) => c.status === 'Active').length,
    planned: campaigns.filter((c) => c.status === 'Planned').length,
  };
}

/** Return class: under 1× loses money, 10× and up is a star. */
export const roiTone = (x: number | null) => (x === null ? '' : x < 1 ? 'lo' : x >= 10 ? 'hi' : '');
export const roiText = (x: number | null) => (x === null ? '—' : `${x.toFixed(1)}×`);

/** Share of the run gone by today, 0 to 1. */
export function elapsedShare(c: Pick<Campaign, 'startDate' | 'endDate'>, now = Date.now()): number {
  const s = dayOffset(c.startDate, now);
  return Math.max(0, Math.min(1, (1 - s) / runDays(c)));
}

/** Where spend should be by today, 0 to 1: nothing before the start, all of it once finished. */
export function expectedSpend(c: Campaign, now = Date.now()): number {
  if (c.status === 'Planned') return 0;
  if (c.status === 'Active') return elapsedShare(c, now);
  return 1;
}

export function paceText(c: Campaign, spentShare: number, now = Date.now()): string {
  if (c.status !== 'Active') return '';
  const e = expectedSpend(c, now);
  return spentShare > e + 0.1 ? 'ahead of plan' : spentShare < e - 0.1 ? 'behind plan' : 'on plan';
}

/** When a cancelled campaign stopped: its last "Cancelled" history line, or its end date. */
export function stoppedAt(c: Campaign): string {
  const line = [...(c.history ?? [])].reverse().find((h) => h.text.startsWith('Cancelled'));
  return line?.at ?? c.endDate;
}

export interface WeekStrip {
  /** Weeks in the run. */
  n: number;
  /** Weeks that have gone (the rest are still to come). */
  done: number;
  vals: number[];
}

/**
 * Leads that came in each week of the run. A lead from before the start counts in the first week, one that came
 * after the end (a late reply) in the last week that has gone.
 */
export function weeksOf(c: Campaign, leads: Lead[], now = Date.now()): WeekStrip {
  const start = startOfDay(Date.parse(c.startDate));
  const n = Math.max(1, Math.ceil(runDays(c) / 7));
  const lastAt = c.status === 'Cancelled' ? Date.parse(stoppedAt(c)) : c.status === 'Active' ? now : Date.parse(c.endDate);
  const done = c.status === 'Planned' ? 0 : Math.max(1, Math.min(n, Math.floor((startOfDay(lastAt) - start) / (7 * DAY)) + 1));
  const vals = Array.from({ length: done }, () => 0);
  if (!done) return { n, done, vals };
  for (const l of leads) {
    const w = Math.floor((Date.parse(l.createdAt) - start) / (7 * DAY));
    vals[Math.max(0, Math.min(done - 1, Number.isFinite(w) ? w : 0))] += 1;
  }
  return { n, done, vals };
}

// ---- the runway: a window of months around the campaigns ----
export interface RunWindow { from: number; to: number; months: { at: number; label: string }[] }

export function runWindow(dates: { startDate: string; endDate: string }[], now = Date.now()): RunWindow {
  const today = startOfDay(now);
  let lo = today - 60 * DAY;
  let hi = today + 60 * DAY;
  for (const d of dates) {
    lo = Math.min(lo, Date.parse(d.startDate));
    hi = Math.max(hi, Date.parse(d.endDate));
  }
  lo = Math.max(lo, today - 365 * DAY);
  hi = Math.min(hi, today + 365 * DAY);
  const f = new Date(lo);
  const from = new Date(f.getFullYear(), f.getMonth(), 1).getTime();
  const t = new Date(hi);
  const to = new Date(t.getFullYear(), t.getMonth() + 1, 1).getTime();
  const months: RunWindow['months'] = [];
  const thisYear = new Date(now).getFullYear();
  for (let m = new Date(from); m.getTime() < to; m = new Date(m.getFullYear(), m.getMonth() + 1, 1)) {
    const label = m.toLocaleDateString('en-GB', { month: 'short' }) + (m.getFullYear() !== thisYear && m.getMonth() === 0 ? ` ’${String(m.getFullYear()).slice(2)}` : '');
    months.push({ at: m.getTime(), label });
  }
  return { from, to, months };
}

/** Where a moment sits on the window, 0 to 100. */
export const pctOn = (w: RunWindow, ms: number) => ((Math.max(w.from, Math.min(w.to, ms)) - w.from) / (w.to - w.from)) * 100;

// ---- planning ----
/** Spent per lead across the bank's campaigns, optionally for one channel. Null when none has leads yet. */
export function averageCpl(campaigns: Campaign[], stats: Map<string, CampaignStats>, channel?: string, skipId?: string | null): number | null {
  let spent = 0;
  let leads = 0;
  for (const c of campaigns) {
    if (c.id === skipId || (channel && c.channel !== channel)) continue;
    const s = stats.get(c.id);
    if (!s || !s.leads.length || !s.spent) continue;
    spent += s.spent;
    leads += s.leads.length;
  }
  return leads ? spent / leads : null;
}

/** Campaigns on the same channel whose run crosses the given days. Cancelled ones are left out. */
export function overlapping(campaigns: Campaign[], channel: string, s: number, e: number, skipId?: string | null, now = Date.now()): Campaign[] {
  if (!channel) return [];
  return campaigns.filter((c) => c.id !== skipId && c.channel === channel && c.status !== 'Cancelled'
    && dayOffset(c.startDate, now) <= e && dayOffset(c.endDate, now) >= s);
}

export function matchesCampaign(c: Campaign, query: string, ownerName = ''): boolean {
  const q = query.trim().toLowerCase();
  return !q || `${c.name} ${c.channel} ${c.status} ${ownerName} ${c.audience ?? ''}`.toLowerCase().includes(q);
}

export const canWriteCampaigns = (role: string | undefined) => role === 'admin' || role === 'rep';
