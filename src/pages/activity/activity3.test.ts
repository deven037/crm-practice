import { describe, expect, it } from 'vitest';
import { Meeting } from '../../types';
import {
  activityType, dueText, findClash, heatCells, heatLevel, isoAt, lanes, LinkTarget, ownedBy, parseQuick, snapStart, startOfDay, taskGroup, weekStart,
} from './activityLogic';

// Tuesday 17 November 2026, 14:20.
const NOW = new Date(2026, 10, 17, 14, 20);
const day = (offset: number, hour = 12) => new Date(2026, 10, 17 + offset, hour).toISOString();
const records: LinkTarget[] = [
  { module: 'contacts', id: 'c1', name: 'Kavya Anand' },
  { module: 'accounts', id: 'a1', name: 'Verma Textiles Pvt Ltd' },
];

describe('quick add', () => {
  it('reads date, time, priority and customer out of plain text', () => {
    expect(parseQuick('Call Kavya tomorrow 3pm high', records, NOW)).toEqual({
      title: 'Call Kavya', dueOffset: 1, time: '15:00', priority: 'High', record: records[0],
    });
  });

  it('understands weekdays, 24-hour times and low priority', () => {
    const p = parseQuick('Collect audit pack from Verma on friday 10:30 low', records, NOW);
    expect(p.dueOffset).toBe(3);
    expect(p.time).toBe('10:30');
    expect(p.priority).toBe('Low');
    expect(p.record?.id).toBe('a1');
    expect(p.title).toBe('Collect audit pack from Verma');
  });

  it('puts a task with only a time on today, and leaves plain text alone', () => {
    expect(parseQuick('Ring the branch at 9am', records, NOW)).toMatchObject({ dueOffset: 0, time: '09:00' });
    expect(parseQuick('Prepare the board pack', records, NOW)).toMatchObject({ title: 'Prepare the board pack', dueOffset: null, time: null, priority: null, record: null });
  });
});

describe('task groups', () => {
  it('sorts tasks into overdue, today, tomorrow, later this week and later', () => {
    const g = (offset: number) => taskGroup({ completed: false, dueDate: day(offset) }, NOW);
    expect([g(-1), g(0), g(1), g(4), g(5), g(9)]).toEqual(['late', 'today', 'tomorrow', 'week', 'week', 'later']);
    expect(taskGroup({ completed: true, dueDate: day(-3) }, NOW)).toBe('done');
  });

  it('describes when a task is due', () => {
    expect(dueText({ completed: false, dueDate: day(-2), dueTime: null }, NOW)).toEqual({ text: '2 days late', tone: 'late' });
    expect(dueText({ completed: false, dueDate: day(0), dueTime: '15:00' }, NOW)).toEqual({ text: 'Today 15:00', tone: 'soon' });
    expect(dueText({ completed: false, dueDate: day(1), dueTime: '10:00' }, NOW).text).toBe('Tomorrow 10:00');
  });

  it('shows tasks without an owner to everyone', () => {
    expect(ownedBy({ ownerId: null }, ['u1'])).toBe(true);
    expect(ownedBy({ ownerId: 'u2' }, ['u1'])).toBe(false);
    expect(ownedBy({ ownerId: 'u2' }, [])).toBe(true);
  });
});

describe('calendar', () => {
  it('places overlapping meetings side by side', () => {
    const placed = lanes([{ id: 'a', start: 600, dur: 60 }, { id: 'b', start: 630, dur: 30 }, { id: 'c', start: 720, dur: 30 }]);
    expect(placed.get('a')).toEqual({ lane: 0, of: 2 });
    expect(placed.get('b')).toEqual({ lane: 1, of: 2 });
    expect(placed.get('c')).toEqual({ lane: 0, of: 1 });
  });

  it('finds a clash and ignores the meeting being edited', () => {
    const m = (id: string, hour: number, dur: number): Meeting => ({ id, title: id, type: 'Meeting', start: isoAt(startOfDay(NOW), hour * 60), durationMin: dur, ownerId: 'u1', attendeeIds: [], contactIds: [], location: '', reminder: '', notes: '', createdAt: '' });
    const list = [m('legal', 11, 60), m('lunch', 13, 60)];
    expect(findClash(list, isoAt(startOfDay(NOW), 11 * 60 + 30), 30)?.id).toBe('legal');
    expect(findClash(list, isoAt(startOfDay(NOW), 12 * 60), 60)).toBeUndefined();
    expect(findClash(list, isoAt(startOfDay(NOW), 11 * 60), 60, 'legal')).toBeUndefined();
  });

  it('snaps a drag to 15 minutes inside the working day', () => {
    expect(snapStart(52 * 2 + 10, 52, 60)).toBe(10 * 60 + 15);
    expect(snapStart(-30, 52, 60)).toBe(8 * 60);
    expect(snapStart(5000, 52, 60)).toBe(18 * 60);
  });

  it('starts the week on Monday', () => {
    expect(weekStart(NOW).getDay()).toBe(1);
    expect(weekStart(NOW).getDate()).toBe(16);
  });
});

describe('activity', () => {
  it('reads the type of older activities from their emoji', () => {
    expect(activityType({ icon: '📞' })).toBe('Call');
    expect(activityType({ icon: '💰' })).toBe('Deal update');
    expect(activityType({ icon: 'Visit', type: 'Visit' })).toBe('Visit');
  });

  it('builds 12 weeks of day cells, with days still to come marked', () => {
    const cells = heatCells([{ when: day(0, 9) }, { when: day(0, 11) }, { when: day(-8, 10) }], NOW);
    expect(cells).toHaveLength(84);
    expect(cells[0].date.getDay()).toBe(1);
    expect(cells.find((c) => c.offset === 0)?.count).toBe(2);
    expect(cells.find((c) => c.offset === -8)?.count).toBe(1);
    expect(cells.find((c) => c.offset === 1)?.count).toBe(-1);
    expect([0, 1, 3, 6, 9].map(heatLevel)).toEqual([0, 1, 2, 3, 4]);
  });
});
