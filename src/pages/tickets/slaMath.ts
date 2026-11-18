import type { SlaClock, SlaConfig, SlaRules, Ticket, TicketPriority, TicketStatus } from '../../types';
import { TICKET_DONE } from '../../types';

/*
 * SLA time for tickets. A copy of server/src/sla.ts (the server writes the due times; the
 * browser uses this for previews and the live clocks). Keep the two in step.
 */

export const DEFAULT_SLA_RULES: SlaRules = {
  id: 'sla-rules',
  warnPercent: 80,
  notifyOnWarn: true,
  escalateOnBreach: true,
  level1UserId: null,
  level2: true,
  level2AfterMinutes: 120,
  level2UserId: null,
  autoAssign: true,
  autoAssignMinutes: 30,
  pauseStatuses: ['Waiting on customer'],
  workingDays: [1, 2, 3, 4, 5, 6],
  workFrom: '09:00',
  workTo: '18:00',
  timeZone: 'Asia/Kolkata',
};

/** The standard promise per priority, used when a bank's SLA settings leave a value out. */
export const DEFAULT_POLICY: Record<TicketPriority, { firstReplyHours: number; hours: number; clock: SlaClock }> = {
  Urgent: { firstReplyHours: 0.25, hours: 4, clock: '24x7' },
  High: { firstReplyHours: 1, hours: 8, clock: '24x7' },
  Medium: { firstReplyHours: 4, hours: 24, clock: 'working' },
  Low: { firstReplyHours: 8, hours: 48, clock: 'working' },
};

export interface Policy {
  firstReplyMinutes: number;
  resolveMinutes: number;
  clock: SlaClock;
}

export function policyFor(priority: TicketPriority, configs: SlaConfig[]): Policy {
  const d = DEFAULT_POLICY[priority] ?? DEFAULT_POLICY.Medium;
  const c = configs.find((x) => x.priority === priority);
  return {
    firstReplyMinutes: Math.round((c?.firstReplyHours ?? d.firstReplyHours) * 60),
    resolveMinutes: Math.round((c?.hours ?? d.hours) * 60),
    clock: c?.clock ?? d.clock,
  };
}

export function rulesOf(list: SlaRules[]): SlaRules {
  return { ...DEFAULT_SLA_RULES, ...(list[0] ?? {}), id: 'sla-rules' };
}

const MIN = 60_000;

/** Minutes the time zone is ahead of UTC at that moment. */
export function zoneOffsetMinutes(timeZone: string, ms: number): number {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(new Date(ms));
    const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
    const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
    return Math.round((asUtc - Math.floor(ms / 1000) * 1000) / MIN);
  } catch {
    return 0;
  }
}

const hhmm = (s: string) => {
  const [h, m] = s.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

/** Adds SLA minutes to a moment: plain clock time, or only the bank's working hours. */
export function addSlaMinutes(startMs: number, minutes: number, clock: SlaClock, rules: SlaRules): number {
  if (clock !== 'working') return startMs + minutes * MIN;
  const from = hhmm(rules.workFrom);
  const to = hhmm(rules.workTo);
  if (to <= from || rules.workingDays.length === 0) return startMs + minutes * MIN;
  let t = startMs;
  let left = minutes;
  let guard = 0;
  while (left > 0 && guard++ < 5000) {
    const local = new Date(t + zoneOffsetMinutes(rules.timeZone, t) * MIN);
    const tod = local.getUTCHours() * 60 + local.getUTCMinutes() + local.getUTCSeconds() / 60 + local.getUTCMilliseconds() / MIN;
    const midnight = t - tod * MIN;
    if (!rules.workingDays.includes(local.getUTCDay()) || tod >= to) {
      t = midnight + (24 * 60 + from) * MIN;
      continue;
    }
    if (tod < from) {
      t = midnight + from * MIN;
      continue;
    }
    const chunk = Math.min(left, to - tod);
    t += chunk * MIN;
    left -= chunk;
  }
  return t;
}

export const isDone = (status: TicketStatus) => TICKET_DONE.includes(status);
export const pauses = (status: TicketStatus, rules: SlaRules) => !isDone(status) && rules.pauseStatuses.includes(status);

/** Due times worked out from when the ticket was raised, its priority and the time it has spent paused. */
export function duesFor(ticket: Pick<Ticket, 'createdAt' | 'priority' | 'pausedMinutes'>, configs: SlaConfig[], rules: SlaRules) {
  const policy = policyFor(ticket.priority, configs);
  const start = Date.parse(ticket.createdAt) || Date.now();
  const paused = (ticket.pausedMinutes ?? 0) * MIN;
  return {
    slaDue: new Date(addSlaMinutes(start, policy.resolveMinutes, policy.clock, rules) + paused).toISOString(),
    firstReplyDue: new Date(addSlaMinutes(start, policy.firstReplyMinutes, policy.clock, rules) + paused).toISOString(),
  };
}

/** The changes a status move makes to the clock: a pause starts or ends, a resolve stops it, a reopen restarts it. */
export function statusPatch(ticket: Ticket, to: TicketStatus, now: number, rules: SlaRules): Partial<Ticket> {
  const patch: Partial<Ticket> = { status: to };
  if (ticket.pausedAt && !pauses(to, rules)) {
    const minutes = Math.max(0, (now - Date.parse(ticket.pausedAt)) / MIN);
    patch.pausedAt = null;
    patch.pausedMinutes = (ticket.pausedMinutes ?? 0) + minutes;
    patch.slaDue = new Date(Date.parse(ticket.slaDue) + minutes * MIN).toISOString();
    if (ticket.firstReplyDue && !ticket.firstReplyAt) patch.firstReplyDue = new Date(Date.parse(ticket.firstReplyDue) + minutes * MIN).toISOString();
  }
  if (pauses(to, rules) && !ticket.pausedAt) patch.pausedAt = new Date(now).toISOString();
  if (isDone(to)) patch.resolvedAt = ticket.resolvedAt ?? new Date(now).toISOString();
  else patch.resolvedAt = null;
  return patch;
}

/** How far through its resolve time an open ticket is, 0 to 1 and over. */
export function usedShare(ticket: Ticket, now: number): number {
  const start = Date.parse(ticket.createdAt);
  const due = Date.parse(ticket.slaDue);
  const at = ticket.pausedAt ? Date.parse(ticket.pausedAt) : now;
  const total = due - start - (ticket.pausedMinutes ?? 0) * MIN;
  if (!(total > 0)) return at > due ? 1 : 0;
  return (total - (due - at)) / total;
}
