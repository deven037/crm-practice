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
    sortIndicator: () => '', onToggleSort: vi.fn(),
    onToggleSelectAll: vi.fn(), onToggleSelect: vi.fn(),
    onOpen: vi.fn(), onContextMenu: vi.fn(), onConvert: vi.fn(),
  }));
}

beforeEach(() => { auth.role = 'viewer'; });

describe('Leads table contact field visibility', () => {
  it.each<Role | undefined>(['viewer', undefined])('omits headers and values for %s', (role) => {
    auth.role = role;
    const html = render([lead]);
    expect(html).not.toContain('>Email</th>');
    expect(html).not.toContain('>Phone</th>');
    expect(html).not.toContain(lead.email);
    expect(html).not.toContain(lead.phone);
    expect(html).toContain(lead.name);
    expect(html).toContain(lead.company);
    expect(html.match(/<th[ >]/g)).toHaveLength(9);
    expect(html.match(/<td[ >]/g)).toHaveLength(9);
  });

  it.each<Role>(['admin', 'rep'])('preserves headers and values for %s', (role) => {
    auth.role = role;
    const html = render([lead]);
    expect(html).toContain('>Email</th>');
    expect(html).toContain('>Phone</th>');
    expect(html).toContain(lead.email);
    expect(html).toContain(lead.phone);
    expect(html.match(/<th[ >]/g)).toHaveLength(11);
    expect(html.match(/<td[ >]/g)).toHaveLength(11);
  });

  it.each<Role>(['viewer', 'admin', 'rep'])('spans the visible columns in both empty states for %s', (role) => {
    auth.role = role;
    const span = role === 'viewer' ? 9 : 11;
    expect(render([])).toContain(`colSpan="${span}"`);
    expect(render([])).toContain('No leads yet.');
    expect(render([], 1)).toContain(`colSpan="${span}"`);
    expect(render([], 1)).toContain('No leads match the current filters.');
  });
});

function leadWithStatus(status: LeadStatus): Lead {
  return { ...lead, status };
}

function convertButton(status: LeadStatus): string {
  const match = render([leadWithStatus(status)]).match(/<button[^>]*>Convert<\/button>/);
  if (!match) throw new Error('Convert button not rendered');
  return match[0];
}

describe('LeadsTable Convert button', () => {
  beforeEach(() => { auth.role = 'admin'; });

  it('is disabled with an explanation for a Converted lead', () => {
    const button = convertButton('Converted');
    expect(button).toContain('disabled');
    expect(button).toContain('This lead is already converted.');
  });

  it.each<LeadStatus>(['New', 'Contacted', 'Qualified', 'Unqualified'])('is enabled for a %s lead', (status) => {
    const button = convertButton(status);
    expect(button).not.toContain('disabled');
    expect(button).not.toContain('already converted');
  });
});
