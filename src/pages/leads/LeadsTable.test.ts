import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Lead, LeadStatus } from '../../types';
import { LeadsTable } from './LeadsTable';

function lead(id: string, status: LeadStatus): Lead {
  return {
    id,
    name: `Lead ${id}`,
    company: 'Acme',
    email: `${id}@acme.test`,
    phone: '555-0100',
    status,
    source: 'Web',
    ownerId: 'u1',
    value: 1000,
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

function convertButton(status: LeadStatus): string {
  const html = renderToStaticMarkup(
    createElement(LeadsTable, {
      rows: [lead('l1', status)],
      totalLeads: 1,
      selected: [],
      allPageSelected: false,
      sortKey: 'name',
      sortDir: 'asc',
      ownerName: () => 'Owner',
      sortIndicator: () => '',
      onToggleSort: () => undefined,
      onToggleSelectAll: () => undefined,
      onToggleSelect: () => undefined,
      onOpen: () => undefined,
      onContextMenu: () => undefined,
      onConvert: () => undefined,
    })
  );
  const match = html.match(/<button[^>]*>Convert<\/button>/);
  if (!match) throw new Error('Convert button not rendered');
  return match[0];
}

describe('LeadsTable Convert button', () => {
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
