import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../hooks/useMediaQuery', () => ({ useMediaQuery: () => false }));
vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ user: null, logout: vi.fn() }),
}));
vi.mock('../data/store', () => ({
  getAllSync: () => [],
  getValue: (_key: string, fallback: unknown) => fallback,
  setValue: vi.fn(),
}));

import { NotificationsPanel } from './NotificationsPanel';
import { Layout } from './Layout';

function render(initialSidebarCollapsed = false): string {
  return renderToStaticMarkup(
    createElement(
      MemoryRouter,
      null,
      createElement(Layout, { initialSidebarCollapsed }, createElement('div', null, 'Page'))
    )
  );
}

describe('Layout sidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps navigation names accessible and hides labels when collapsed', () => {
    const html = render(true);

    expect(html).toContain('class="app-shell sidebar-collapsed"');
    for (const label of ['Dashboard', 'Activity', 'Leads', 'Contacts', 'Accounts']) {
      expect(html).toContain(`aria-label="${label}"`);
      expect(html).not.toContain(`>${label}</span>`);
    }
  });

  it('shows navigation labels when expanded by default', () => {
    const html = render();

    expect(html).toContain('class="app-shell"');
    for (const label of ['Dashboard', 'Activity', 'Leads']) {
      expect(html).toContain(`aria-label="${label}"`);
      expect(html).toContain(`>${label}</span>`);
    }
  });
});

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
