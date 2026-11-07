import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { EmailTooltip } from './Contacts';

describe('EmailTooltip', () => {
  it('is keyboard focusable and carries the full email in both views', () => {
    for (const as of ['div', 'td'] as const) {
      const html = renderToStaticMarkup(createElement(as === 'td' ? 'tr' : 'div', null, createElement(EmailTooltip, { as, email: 'meera.mehta@example.com' })));
      expect(html).toContain('tabindex="0"');
      expect(html).toContain('data-tooltip="meera.mehta@example.com"');
      expect(html).toContain('has-tooltip');
    }
  });
});
