import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { NotificationsPanel } from './Layout';

describe('NotificationsPanel', () => {
  it('shows the empty message and disables Mark all read at zero unread', () => {
    const html = renderToStaticMarkup(
      createElement(NotificationsPanel, {
        items: [{ id: 'read-notification', text: 'Already read', read: true, when: '2026-10-28T00:00:00.000Z' }],
        onMarkAllRead: vi.fn(),
      })
    );

    expect(html).toContain('No notifications');
    expect(html).toMatch(/<button[^>]*disabled="">Mark all read<\/button>/);
  });
});
