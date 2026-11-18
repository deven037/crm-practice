import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { Activity } from '../types';
import { ActivityView } from './Activity';

const now = new Date(2026, 10, 17, 15, 0);
const at = (days: number, hour: number) => new Date(2026, 10, 17 + days, hour).toISOString();
const activities: Activity[] = [
  { id: 'a1', text: 'Priya moved Acme renewal to Negotiation', icon: '💰', when: at(-1, 10) },
  { id: 'a2', text: 'Priya Nair called Kavya Anand', icon: 'Call', type: 'Call', when: at(0, 13), userName: 'Priya Nair', recordModule: 'contacts', recordId: 'c1', recordName: 'Kavya Anand', outcome: 'Connected', durationMin: 12, notes: 'Agreed to review the pricing.' },
];

function render(props: { loading?: boolean; failed?: boolean; activities?: Activity[]; canLog?: boolean }): string {
  return renderToStaticMarkup(createElement(MemoryRouter, null, createElement(ActivityView, {
    loading: props.loading ?? false,
    failed: props.failed ?? false,
    activities: props.activities ?? [],
    canLog: props.canLog ?? true,
    onRetry: () => undefined,
    now,
  })));
}

describe('ActivityView', () => {
  it('shows a status region while loading', () => {
    const html = render({ loading: true });
    expect(html).toContain('role="status"');
    expect(html).toContain('Loading recent activity');
  });

  it('shows the newest first, grouped by day, with older saved sentences kept as they were', () => {
    const html = render({ activities });
    expect(html.indexOf('Today')).toBeLessThan(html.indexOf('Yesterday'));
    expect(html.indexOf('Kavya Anand')).toBeLessThan(html.indexOf('Priya moved Acme renewal to Negotiation'));
    expect(html).toContain('href="/contacts/c1"');
    expect(html).toContain('Connected · 12 min');
    expect(html).toContain('Agreed to review the pricing.');
  });

  it('counts the last 12 weeks and offers Log activity to people who can log', () => {
    const html = render({ activities });
    expect(html).toContain('<b>2</b> activities');
    expect(html).toContain('href="/activity/new"');
    expect(render({ activities, canLog: false })).not.toContain('href="/activity/new"');
  });

  it('shows the empty state when there is no activity', () => {
    expect(render({ activities: [] })).toContain('No activity yet');
  });

  it('shows an alert with a Retry button when loading failed', () => {
    const html = render({ failed: true });
    expect(html).toContain('role="alert"');
    expect(html).toMatch(/<button[^>]*>Retry<\/button>/);
  });
});
