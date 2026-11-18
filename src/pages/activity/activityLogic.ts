import { Activity, LinkedModule, Meeting, TaskItem, TaskPriority } from '../../types';

/*
 * Activity, Tasks and Calendar 3.0 logic with no React in it: dates and times, task groups, the quick-add
 * parser, calendar lanes and clashes, and the activity heat map. Every function takes "now" so it can be tested.
 */

export const DAY_START = 8 * 60;
export const DAY_END = 19 * 60;
const DAY = 24 * 60 * 60 * 1000;

export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
/** Monday of the week the date falls in. */
export const weekStart = (d: Date) => addDays(startOfDay(d), -((d.getDay() + 6) % 7));
/** Whole calendar days from today to the date (negative when it has passed). */
export const dayOffset = (iso: string | Date, now: Date = new Date()) => Math.round((startOfDay(new Date(iso)).getTime() - startOfDay(now).getTime()) / DAY);
export const minutesOf = (iso: string) => { const d = new Date(iso); return d.getHours() * 60 + d.getMinutes(); };
export const hm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
export const parseHm = (text: string | null | undefined): number | null => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(text ?? '');
  return m ? +m[1] * 60 + +m[2] : null;
};
/** A date at a time of day, as an ISO string. */
export const isoAt = (day: Date, minutes: number) => new Date(day.getFullYear(), day.getMonth(), day.getDate(), Math.floor(minutes / 60), minutes % 60).toISOString();
/** "1 h 30 m", "45 min". */
export const spanLabel = (min: number) => (min >= 60 ? `${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60} m` : ''}` : `${min} min`);
export const dayLabel = (d: Date) => d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
export function relativeDay(d: Date, now: Date = new Date()): string {
  const n = dayOffset(d, now);
  return n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : n === -1 ? 'Yesterday' : dayLabel(d);
}
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

// ---------- tasks ----------

export type TaskGroupId = 'late' | 'today' | 'tomorrow' | 'week' | 'later' | 'done';
export const TASK_GROUPS: { id: TaskGroupId; label: string; hue: string }[] = [
  { id: 'late', label: 'Overdue', hue: 'var(--tone-danger-text)' },
  { id: 'today', label: 'Today', hue: 'var(--bank-primary)' },
  { id: 'tomorrow', label: 'Tomorrow', hue: '#2f6fe0' },
  { id: 'week', label: 'Later this week', hue: '#6d4fd6' },
  { id: 'later', label: 'Later', hue: '#8a93a6' },
  { id: 'done', label: 'Done', hue: '#17936a' },
];
export const PRIORITY_HUE: Record<TaskPriority, string> = { High: '#c2384f', Medium: '#c98a12', Low: '#8a93a6' };

/** Which group a task sits in. "Later this week" runs to Sunday. */
export function taskGroup(task: Pick<TaskItem, 'completed' | 'dueDate'>, now: Date = new Date()): TaskGroupId {
  if (task.completed) return 'done';
  const n = dayOffset(task.dueDate, now);
  if (n < 0) return 'late';
  if (n === 0) return 'today';
  if (n === 1) return 'tomorrow';
  return n <= 6 - ((now.getDay() + 6) % 7) ? 'week' : 'later';
}

export function dueText(task: Pick<TaskItem, 'completed' | 'dueDate' | 'dueTime'>, now: Date = new Date()): { text: string; tone: '' | 'soon' | 'late' } {
  const n = dayOffset(task.dueDate, now);
  const time = task.dueTime ? ` ${task.dueTime}` : '';
  if (task.completed) return { text: n === 0 ? 'Done today' : 'Done', tone: '' };
  if (n < 0) return { text: `${plural(-n, 'day')} late`, tone: 'late' };
  if (n === 0) return { text: `Today${time}`, tone: 'soon' };
  if (n === 1) return { text: `Tomorrow${time}`, tone: '' };
  return { text: `${dayLabel(new Date(task.dueDate))}${time}`, tone: '' };
}

/** Tasks for a person: their own, plus tasks saved before owners existed (those have none and belong to everyone). */
export const ownedBy = (task: Pick<TaskItem, 'ownerId'>, owners: string[]) => !owners.length || !task.ownerId || owners.includes(task.ownerId);

export interface LinkTarget {
  module: LinkedModule;
  id: string;
  name: string;
}

export interface QuickTask {
  title: string;
  /** Days from today; null when no date was typed (the task then lands on today). */
  dueOffset: number | null;
  time: string | null;
  priority: TaskPriority | null;
  record: LinkTarget | null;
}

const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

/**
 * Reads a quick-add line like "Call Kavya tomorrow 3pm high": the date, time and priority words come out of the
 * title, and the first name that matches a customer links the task to them.
 */
export function parseQuick(text: string, records: LinkTarget[], now: Date = new Date()): QuickTask {
  const out: QuickTask = { title: text.trim(), dueOffset: null, time: null, priority: null, record: null };
  let s = ` ${text} `;
  const take = (re: RegExp, fn: (m: RegExpMatchArray) => void) => { const m = s.match(re); if (m) { fn(m); s = s.replace(m[0], ' '); } };
  take(/\s(today|tonight)\s/i, () => (out.dueOffset = 0));
  take(/\s(tomorrow|tmrw)\s/i, () => (out.dueOffset = 1));
  take(/\snext week\s/i, () => (out.dueOffset = 7 - ((now.getDay() + 6) % 7)));
  take(/\s(?:on\s)?(mon|tue|wed|thu|fri|sat|sun)[a-z]*\s/i, (m) => {
    const target = WEEKDAYS.indexOf(m[1].toLowerCase());
    out.dueOffset = ((target - now.getDay() + 7) % 7) || 7;
  });
  take(/\s(?:at\s)?(\d{1,2})(?:[:.](\d{2}))?\s?(am|pm)\s/i, (m) => {
    let h = +m[1] % 12;
    if (m[3].toLowerCase() === 'pm') h += 12;
    out.time = hm(h * 60 + (+m[2] || 0));
  });
  take(/\s(?:at\s)?([01]?\d|2[0-3])[:.]([0-5]\d)\s/, (m) => (out.time = hm(+m[1] * 60 + +m[2])));
  take(/\s(high|urgent|important)(?:\s+priority)?\s/i, () => (out.priority = 'High'));
  take(/\slow(?:\s+priority)?\s/i, () => (out.priority = 'Low'));
  take(/\smedium(?:\s+priority)?\s/i, () => (out.priority = 'Medium'));
  const words = new Set(s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3));
  out.record = records.find((r) => { const first = r.name.split(/\s+/)[0]?.toLowerCase() ?? ''; return first.length > 3 && words.has(first); }) ?? null;
  out.title = s.replace(/\s+/g, ' ').trim();
  if (out.time && out.dueOffset == null) out.dueOffset = 0;
  return out;
}

// ---------- calendar ----------

export interface Slot {
  id: string;
  start: number;
  dur: number;
}

/** Side-by-side placement for overlapping items: lane index and lane count per id. */
export function lanes(items: Slot[]): Map<string, { lane: number; of: number }> {
  const out = new Map<string, { lane: number; of: number }>();
  const sorted = [...items].sort((a, b) => a.start - b.start || b.dur - a.dur);
  let cluster: Slot[] = [];
  let end = -1;
  const flush = () => {
    const ends: number[] = [];
    for (const item of cluster) {
      let lane = ends.findIndex((e) => e <= item.start);
      if (lane < 0) { lane = ends.length; ends.push(0); }
      ends[lane] = item.start + item.dur;
      out.set(item.id, { lane, of: 0 });
    }
    for (const item of cluster) out.get(item.id)!.of = ends.length;
  };
  for (const item of sorted) {
    if (item.start >= end && cluster.length) { flush(); cluster = []; }
    cluster.push(item);
    end = Math.max(end, item.start + item.dur);
  }
  if (cluster.length) flush();
  return out;
}

/** The first meeting that overlaps the given slot on the same day, if any. */
export function findClash(meetings: Meeting[], start: string, durationMin: number, ignoreId?: string): Meeting | undefined {
  const s = new Date(start).getTime();
  const e = s + durationMin * 60000;
  return meetings.find((m) => m.id !== ignoreId && new Date(m.start).getTime() < e && s < new Date(m.start).getTime() + m.durationMin * 60000);
}

export const meetingsOn = (meetings: Meeting[], day: Date) => meetings.filter((m) => dayOffset(m.start, day) === 0);

/** Snaps a pointer position inside a day column to a start time, in 15-minute steps, keeping the meeting inside the day. */
export function snapStart(y: number, hourPx: number, durationMin: number): number {
  const raw = DAY_START + (y / hourPx) * 60;
  const snapped = Math.round(raw / 15) * 15;
  return Math.max(DAY_START, Math.min(DAY_END - Math.min(durationMin, DAY_END - DAY_START), snapped));
}

// ---------- activity ----------

/** Activities saved before 3.0 carry an emoji; this reads their type from it. */
const LEGACY: Record<string, string> = { '📞': 'Call', '✉️': 'Email', '📅': 'Meeting', '💰': 'Deal update', '📝': 'Note', '✅': 'Task done' };
export const activityType = (a: Pick<Activity, 'type' | 'icon'>) => a.type || LEGACY[a.icon] || 'Note';
export const isSystemType = (type: string) => type === 'Deal update' || type === 'Task done';

export interface HeatCell {
  date: Date;
  offset: number;
  /** -1 for days still to come. */
  count: number;
}

/** One cell per day for the last `weeks` weeks, Monday first, ending with this week. */
export function heatCells(activities: Pick<Activity, 'when'>[], now: Date = new Date(), weeks = 12): HeatCell[] {
  const counts = new Map<number, number>();
  for (const a of activities) {
    const off = dayOffset(a.when, now);
    counts.set(off, (counts.get(off) ?? 0) + 1);
  }
  const first = addDays(weekStart(now), -7 * (weeks - 1));
  return Array.from({ length: weeks * 7 }, (_, i) => {
    const date = addDays(first, i);
    const offset = dayOffset(date, now);
    return { date, offset, count: offset > 0 ? -1 : counts.get(offset) ?? 0 };
  });
}

export const heatLevel = (n: number) => (n <= 0 ? 0 : n <= 2 ? 1 : n <= 4 ? 2 : n <= 7 ? 3 : 4);

export function countBy<T>(items: T[], key: (item: T) => string): [string, number][] {
  const m = new Map<string, number>();
  for (const item of items) m.set(key(item), (m.get(key(item)) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}
