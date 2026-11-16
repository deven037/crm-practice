import { describe, expect, it } from 'vitest';
import { NAV_GROUPS, badgeText, navCounts, placeForPath } from './nav';
import { groupNotifications, lookFor } from './NotificationsPanel';
import { togglePinned } from '../../hooks/usePinned';
import { matchPages } from '../CommandBar';

describe('side menu', () => {
  it('holds only module pages: no Settings, Setup, Test Cases or create links', () => {
    const links = NAV_GROUPS.flatMap((g) => g.items.map((i) => i.to));
    expect(links).toEqual(['/', '/activity', '/leads', '/contacts', '/accounts', '/deals', '/quotes', '/products', '/campaigns', '/tasks', '/tickets', '/data-studio']);
    expect(links.some((to) => to.endsWith('/new'))).toBe(false);
  });

  it('names where an address sits', () => {
    expect(placeForPath('/')).toMatchObject({ group: 'Home', label: 'Dashboard', recordId: null });
    expect(placeForPath('/leads')).toMatchObject({ group: 'Customers', label: 'Leads', recordId: null });
    expect(placeForPath('/leads/L-7')).toMatchObject({ group: 'Customers', label: 'Leads', recordId: 'L-7', to: '/leads' });
    expect(placeForPath('/leads/new').recordId).toBeNull();
    expect(placeForPath('/data-studio/analysis').recordId).toBeNull();
    expect(placeForPath('/setup/users')).toMatchObject({ group: null, label: 'Setup' });
    expect(placeForPath('/settings').label).toBe('Profile settings');
    expect(placeForPath('/nowhere').label).toBe('Page not found');
  });

  it('counts the work that is waiting', () => {
    const counts = navCounts(
      [{ status: 'New' }, { status: 'New' }, { status: 'Qualified' }],
      [
        { completed: false, dueDate: '2026-11-16' },
        { completed: false, dueDate: '2026-11-10' },
        { completed: true, dueDate: '2026-11-01' },
        { completed: false, dueDate: '2026-12-01' },
      ],
      [{ status: 'Open', priority: 'Urgent' }, { status: 'In Progress', priority: 'Low' }, { status: 'Closed', priority: 'Urgent' }],
      '2026-11-16T09:00:00.000Z',
    );
    expect(counts['/leads']).toEqual({ count: 2, hot: false });
    expect(counts['/tasks']).toEqual({ count: 2, hot: true });
    expect(counts['/tickets']).toEqual({ count: 2, hot: true });
  });

  it('is calm when nothing is late or urgent', () => {
    const counts = navCounts([], [{ completed: false, dueDate: '2026-11-16' }], [{ status: 'Open', priority: 'Low' }], '2026-11-16T09:00:00.000Z');
    expect(counts['/tasks'].hot).toBe(false);
    expect(counts['/tickets'].hot).toBe(false);
  });

  it('keeps a big count inside its badge', () => {
    expect(badgeText(7)).toBe('7');
    expect(badgeText(250)).toBe('99+');
  });
});

describe('notifications panel', () => {
  const now = new Date('2026-11-16T12:00:00');
  const items = [
    { id: 'a', text: 'Old', read: true, when: new Date('2026-11-14T09:00:00').toISOString() },
    { id: 'b', text: 'Fresh', read: false, when: new Date('2026-11-16T11:00:00').toISOString() },
    { id: 'c', text: 'Morning', read: true, when: new Date('2026-11-16T08:00:00').toISOString() },
  ];

  it('groups by day, newest first', () => {
    const groups = groupNotifications(items, 'all', now);
    expect(groups.map((g) => g.day)).toEqual(['Today', 'Earlier']);
    expect(groups[0].items.map((n) => n.id)).toEqual(['b', 'c']);
  });

  it('shows only unread on the Unread tab and drops empty days', () => {
    const groups = groupNotifications(items, 'unread', now);
    expect(groups).toHaveLength(1);
    expect(groups[0].items.map((n) => n.id)).toEqual(['b']);
    expect(groupNotifications([], 'all', now)).toEqual([]);
  });

  it('marks deadline notifications as warnings', () => {
    expect(lookFor('Ticket T-1 is overdue').tone).toBe('warn');
    expect(lookFor('New lead assigned to you').tone).toBeUndefined();
  });
});

describe('pinned records', () => {
  const a = { module: 'leads', id: '1', label: 'A', link: '/leads/1' };
  const b = { module: 'deals', id: '2', label: 'B', link: '/deals/2' };

  it('adds the newest first and removes on a second press', () => {
    expect(togglePinned([a], b)).toEqual([b, a]);
    expect(togglePinned([b, a], a)).toEqual([b]);
  });

  it('drops the oldest past the limit', () => {
    expect(togglePinned([a], b, 1)).toEqual([b]);
  });
});

describe('command bar pages', () => {
  it('finds pages by name and offers no create actions', () => {
    expect(matchPages('tick').map((p) => p.label)).toEqual(['Tickets']);
    expect(matchPages('').length).toBe(5);
    expect(matchPages('new')).toEqual([]);
  });
});
