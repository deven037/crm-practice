import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { Activity } from '../types';
import { ActivityView } from './Activity';

const activities: Activity[] = [
  { id: 'a1', text: 'Priya moved Acme renewal to Negotiation', icon: 'deal', when: new Date().toISOString() },
  { id: 'a2', text: 'Sam closed ticket 4821', icon: 'ticket', when: new Date().toISOString() },
];

function render(props: { loading?: boolean; failed?: boolean; activities?: Activity[] }): string {
  return renderToStaticMarkup(
    createElement(
      MemoryRouter,
      null,
      createElement(ActivityView, {
        loading: props.loading ?? false,
        failed: props.failed ?? false,
        activities: props.activities ?? [],
        onRetry: () => undefined,
      })
    )
  );
}

describe('ActivityView', () => {
  it('shows a status region while loading, and no back link', () => {
    const html = render({ loading: true });
    expect(html).toContain('role="status"');
    expect(html).toContain('Loading recent activity');
    expect(html).not.toContain('Back to Dashboard');
  });

  it('lists entries in the order given and links back to the Dashboard', () => {
    const html = render({ activities });
    expect(html.indexOf(activities[0].text)).toBeGreaterThan(-1);
    expect(html.indexOf(activities[0].text)).toBeLessThan(html.indexOf(activities[1].text));
    expect(html).toMatch(/<a[^>]*href="\/dashboard"[^>]*>Back to Dashboard<\/a>/);
  });

  it('shows the empty state when there is no activity', () => {
    const html = render({ activities: [] });
    expect(html).toContain('No activity yet');
    expect(html).not.toContain('activity-timeline');
  });

  it('shows an alert with a Retry button when loading failed', () => {
    const html = render({ failed: true });
    expect(html).toContain('role="alert"');
    expect(html).toMatch(/<button[^>]*>Retry<\/button>/);
    expect(html).not.toContain('Back to Dashboard');
  });
});
