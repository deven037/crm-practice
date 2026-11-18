import { describe, expect, it } from 'vitest';
import { Ticket } from '../../types';
import { addSlaMinutes, DEFAULT_SLA_RULES, duesFor, statusPatch } from './slaMath';
import {
  cannedLabel, fillCanned, firstReplyInfo, fuseText, metThisWeek, similarTickets, slaState, sortQueue, spanText, threadOf, ticketRef, TICKET_VIEWS,
  viewById, whenText,
} from './ticketLogic';

const H = 3_600_000;
const NOW = Date.UTC(2026, 10, 18, 6, 10); // Wed 18 Nov 2026, 11:40 India time

function ticket(over: Partial<Ticket> = {}): Ticket {
  return {
    id: 'ticket-1048', subject: 'UPI collect requests failing', description: 'Every collect request fails.', requester: 'Kavya Anand',
    priority: 'Urgent', status: 'In Progress', createdAt: new Date(NOW - 3 * H).toISOString(), slaDue: new Date(NOW + 1 * H).toISOString(),
    comments: [], attachments: [], firstReplyDue: new Date(NOW - 2.75 * H).toISOString(), firstReplyAt: new Date(NOW - 2.9 * H).toISOString(),
    pausedAt: null, pausedMinutes: 0, resolvedAt: null, ownerId: 'user-2', escalation: 0, ...over,
  };
}

describe('SLA clock', () => {
  it('counts working hours in the bank time zone and skips Sundays', () => {
    const sat5pm = Date.UTC(2026, 10, 21, 11, 30);
    expect(new Date(addSlaMinutes(sat5pm, 120, 'working', DEFAULT_SLA_RULES)).toISOString()).toBe('2026-11-23T04:30:00.000Z');
    const night = Date.UTC(2026, 10, 18, 16, 0); // 21:30 India time
    expect(new Date(addSlaMinutes(night, 30, 'working', DEFAULT_SLA_RULES)).toISOString()).toBe('2026-11-19T04:00:00.000Z');
  });

  it('works out both due times from the policy, adding paused time', () => {
    const t = ticket({ priority: 'High', pausedMinutes: 30 });
    const d = duesFor(t, [], DEFAULT_SLA_RULES);
    expect(Date.parse(d.slaDue) - Date.parse(t.createdAt)).toBe(8.5 * H);
    expect(Date.parse(d.firstReplyDue) - Date.parse(t.createdAt)).toBe(1.5 * H);
  });

  it('moves the due time on when a pause ends and stops the clock on resolve', () => {
    const paused = ticket({ status: 'Waiting on customer', pausedAt: new Date(NOW - H).toISOString() });
    const resumed = statusPatch(paused, 'In Progress', NOW, DEFAULT_SLA_RULES);
    expect(resumed.pausedAt).toBeNull();
    expect(resumed.pausedMinutes).toBe(60);
    expect(Date.parse(resumed.slaDue!)).toBe(Date.parse(paused.slaDue) + H);
    expect(statusPatch(ticket(), 'Resolved', NOW, DEFAULT_SLA_RULES).resolvedAt).toBe(new Date(NOW).toISOString());
    expect(statusPatch(ticket(), 'Waiting on customer', NOW, DEFAULT_SLA_RULES).pausedAt).toBe(new Date(NOW).toISOString());
  });
});

describe('ticket state', () => {
  it('reads ok, warn, hot, breach, paused and done', () => {
    expect(slaState(ticket({ slaDue: new Date(NOW + 10 * H).toISOString(), createdAt: new Date(NOW - H).toISOString() }), NOW)).toBe('ok');
    expect(slaState(ticket(), NOW)).toBe('warn');
    expect(slaState(ticket({ slaDue: new Date(NOW + 0.4 * H).toISOString() }), NOW)).toBe('hot');
    expect(slaState(ticket({ slaDue: new Date(NOW - 0.5 * H).toISOString() }), NOW)).toBe('breach');
    expect(slaState(ticket({ pausedAt: new Date(NOW - H).toISOString() }), NOW)).toBe('paused');
    expect(slaState(ticket({ status: 'Resolved', resolvedAt: new Date(NOW).toISOString() }), NOW)).toBe('done');
  });

  it('writes the lines under the fuse', () => {
    expect(fuseText(ticket(), NOW)[0]).toBe('1 h left');
    expect(fuseText(ticket({ slaDue: new Date(NOW - 40 * 60_000).toISOString() }), NOW)[0]).toBe('Breached 40 m ago');
    expect(fuseText(ticket({ status: 'Resolved', resolvedAt: new Date(NOW).toISOString() }), NOW)[0]).toBe('Met · 1 h to spare');
    expect(fuseText(ticket({ status: 'Closed', resolvedAt: new Date(NOW + 2 * H).toISOString() }), NOW)[0]).toBe('Missed by 1 h');
    expect(fuseText(ticket({ pausedAt: new Date(NOW - 0.5 * H).toISOString() }), NOW)[0]).toBe('Paused · 1 h 30 m left');
  });

  it('owes a first reply until somebody answers', () => {
    const t = ticket({ firstReplyAt: null, firstReplyDue: new Date(NOW + 20 * 60_000).toISOString() });
    expect(firstReplyInfo(t, NOW)).toEqual({ late: false, ms: 20 * 60_000 });
    expect(firstReplyInfo(t, NOW + 30 * 60_000)?.late).toBe(true);
    expect(firstReplyInfo(ticket(), NOW)).toBeNull();
  });
});

describe('queue', () => {
  const list = [
    ticket({ id: 'a', slaDue: new Date(NOW + 5 * H).toISOString() }),
    ticket({ id: 'b', slaDue: new Date(NOW - H).toISOString(), ownerId: null }),
    ticket({ id: 'c', pausedAt: new Date(NOW - H).toISOString(), status: 'Waiting on customer' }),
    ticket({ id: 'd', status: 'Closed', resolvedAt: new Date(NOW - H).toISOString() }),
    ticket({ id: 'e', slaDue: new Date(NOW + 0.5 * H).toISOString(), firstReplyAt: null }),
  ];

  it('puts the least time left first, paused after running, done last', () => {
    expect(sortQueue(list, NOW).map((t) => t.id)).toEqual(['b', 'e', 'a', 'c', 'd']);
  });

  it('has views for breached, unassigned, due within an hour, first reply and paused', () => {
    const ctx = { now: NOW, me: 'user-2', warnPercent: 80 };
    const ids = (view: string) => list.filter((t) => viewById(view).test(t, ctx)).map((t) => t.id);
    expect(ids('breach')).toEqual(['b']);
    expect(ids('unassigned')).toEqual(['b']);
    expect(ids('hour')).toEqual(['e']);
    expect(ids('firstreply')).toEqual(['e']);
    expect(ids('paused')).toEqual(['c']);
    expect(ids('done')).toEqual(['d']);
    expect(ids('open')).toHaveLength(4);
    expect(TICKET_VIEWS.map((v) => v.id)).toContain('escalated');
  });

  it('counts the share of tickets resolved in time this week', () => {
    const done = [
      ticket({ status: 'Resolved', resolvedAt: new Date(NOW - 2 * H).toISOString(), slaDue: new Date(NOW).toISOString() }),
      ticket({ status: 'Resolved', resolvedAt: new Date(NOW - H).toISOString(), slaDue: new Date(NOW - 2 * H).toISOString() }),
    ];
    const met = metThisWeek(done, NOW);
    expect(met.share).toBe(50);
    expect(met.days).toHaveLength(7);
    expect(metThisWeek([], NOW).share).toBeNull();
  });
});

describe('form and conversation helpers', () => {
  it('finds open tickets that share a word with the subject', () => {
    const open = [ticket({ id: 'x', subject: 'Net banking OTP not received' }), ticket({ id: 'y', subject: 'Cheque book', status: 'Closed' })];
    expect(similarTickets('OTP not coming on new phone', open).map((t) => t.id)).toEqual(['x']);
    expect(similarTickets('the and', open)).toEqual([]);
    expect(similarTickets('Cheque book lost', open)).toEqual([]);
  });

  it('fills canned replies with the first name and names them by their first words', () => {
    expect(fillCanned('Hello {first_name}, done.', 'Kavya Anand')).toBe('Hello Kavya, done.');
    expect(cannedLabel('Hello {first_name}, could you share the transaction reference numbers please?')).toBe('could you share the transaction reference numbers…');
  });

  it('starts the conversation with the customer and keeps time order', () => {
    const t = ticket({ comments: [
      { id: 'c2', author: 'Priya', text: 'note', createdAt: new Date(NOW).toISOString(), kind: 'note' },
      { id: 'c1', author: 'Arjun', text: 'hello', createdAt: new Date(NOW - H).toISOString() },
    ] });
    expect(threadOf(t).map((m) => m.kind)).toEqual(['customer', 'reply', 'note']);
  });

  it('formats references, spans and times', () => {
    expect(ticketRef({ id: 'ticket-3' })).toBe('TK-0003');
    expect(ticketRef({ id: 'ticket-1731940000123-4' })).toBe('TK-1234');
    expect(spanText(25 * H + 60_000)).toBe('1 d 1 h');
    expect(spanText(69 * 60_000)).toBe('1 h 9 m');
    expect(whenText(NOW, NOW)).toMatch(/^Today \d\d:\d\d$/);
    expect(whenText(NOW + 24 * H, NOW)).toMatch(/^Tomorrow /);
  });
});
