import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Lead, LeadStatus, Role } from '../../types';
import { LeadsTable } from './LeadsTable';

const auth = vi.hoisted(() => {
  const session: { role: Role | undefined } = { role: 'viewer' };
  return session;
});
vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({ user: auth.role ? { role: auth.role } : undefined }),
}));

const lead: Lead = {
  id: 'lead-1', name: 'Tara Iyer', company: 'Example',
  email: 'tara@example.com', phone: '+91 98509 62925',
  status: 'New', source: 'Web', ownerId: 'owner-1',
  value: 100, createdAt: '2026-11-06T00:00:00Z',
};

function render(rows: Lead[], totalLeads = rows.length) {
  return renderToStaticMarkup(createElement(LeadsTable, {
    rows, totalLeads, selected: [], allPageSelected: false,
    sortKey: 'name', sortDir: 'asc', ownerName: () => 'Owner',
    onToggleSort: vi.fn(),
    onToggleSelectAll: vi.fn(), onToggleSelect: vi.fn(),
    onOpen: vi.fn(), onContextMenu: vi.fn(), onRowMenu: vi.fn(),
  }));
}

beforeEach(() => { auth.role = 'viewer'; });

describe('Leads table contact field visibility', () => {
  it.each<Role | undefined>(['viewer', undefined])('omits headers and values for %s', (role) => {
    auth.role = role;
    const html = render([lead]);
    expect(html).not.toContain(lead.email);
    expect(html).not.toContain(lead.phone);
    expect(html).not.toContain('aria-label="Call Tara Iyer"');
    expect(html).not.toContain('aria-label="Email Tara Iyer"');
    expect(html).toContain(lead.name);
    expect(html).toContain(lead.company);
    expect(html.match(/<th[ >]/g)).toHaveLength(8);
    expect(html.match(/<td[ >]/g)).toHaveLength(8);
  });

  it.each<Role>(['admin', 'rep'])('preserves headers and values for %s', (role) => {
    auth.role = role;
    const html = render([lead]);
    // Email and phone are no longer columns: writers get call and email buttons on the row.
    expect(html).toContain(`href="mailto:${lead.email}"`);
    expect(html).toContain(`href="tel:${lead.phone}"`);
    expect(html.match(/<th[ >]/g)).toHaveLength(8);
    expect(html.match(/<td[ >]/g)).toHaveLength(8);
  });

  it.each<Role>(['viewer', 'admin', 'rep'])('spans the visible columns in both empty states for %s', (role) => {
    auth.role = role;
    const span = 8;
    expect(render([])).toContain(`colSpan="${span}"`);
    expect(render([])).toContain('No leads yet.');
    expect(render([], 1)).toContain(`colSpan="${span}"`);
    expect(render([], 1)).toContain('No leads match the current filters.');
  });
});

describe('LeadsTable row actions and status', () => {
  beforeEach(() => { auth.role = 'admin'; });

  it('replaces the Convert button with a row actions menu button', () => {
    const html = render([lead]);
    expect(html).not.toContain('>Convert</button>');
    expect(html).toContain('aria-label="Actions for Tara Iyer"');
  });

  it.each<LeadStatus>(['New', 'Converted'])('marks a %s lead with the lead-status test id', (status) => {
    const html = render([{ ...lead, status }]);
    expect(html).toContain(`data-testid="lead-status" class="pill status-${status.toLowerCase()}">${status}</span>`);
  });

  it('keeps a long name readable with a title so the page does not widen', () => {
    const name = 'Qa20417947347917191 Automation Regression Lead Name';
    expect(name.length).toBeGreaterThan(40);
    const html = render([{ ...lead, name }]);
    expect(html).toContain(`<td title="${name}">`);
    expect(html).toContain(`<b>${name}</b>`);
  });

  it('shows the lead with the company under the name and who owns it', () => {
    const html = render([lead]);
    expect(html).toContain('<b>Tara Iyer</b><small>Example</small>');
    expect(html).toContain('class="lead-owner"');
  });

  it('wraps long cell values and lets the page shrink inside the main column', () => {
    const css = readFileSync(resolve(__dirname, '../../styles.css'), 'utf8');
    expect(css).toMatch(/\.table td \{ overflow-wrap: anywhere; \}/);
    expect(css).toMatch(/\.table-wrap \{ max-width: 100%; overflow-x: auto;/);
    expect(css).toMatch(/\.page \{[^}]*min-width: 0;/);
  });

  it('renders a card list for phones alongside the table', () => {
    expect(render([lead])).toContain('<ul class="lead-cards"');
  });
});
