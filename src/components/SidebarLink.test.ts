import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { SidebarLink } from './SidebarLink';

function render(collapsed: boolean): string {
  return renderToStaticMarkup(
    createElement(
      MemoryRouter,
      null,
      createElement(SidebarLink, {
        to: '/leads',
        label: 'Leads',
        icon: createElement('svg', { 'aria-hidden': true }),
        collapsed,
      })
    )
  );
}

describe('SidebarLink', () => {
  it('keeps the accessible name and hides the visible label when collapsed', () => {
    const html = render(true);
    expect(html).toMatch(/<a[^>]*aria-label="Leads"[^>]*>/);
    expect(html).not.toContain('>Leads</span>');
  });

  it('shows the visible label when expanded', () => {
    const html = render(false);
    expect(html).toMatch(/<a[^>]*aria-label="Leads"[^>]*>/);
    expect(html).toContain('>Leads</span>');
  });
});
