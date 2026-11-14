import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, expect, it, vi } from 'vitest';
import { ContextMenu } from './ContextMenu';

vi.mock('react', async (original) => ({
  ...await original<typeof import('react')>(), useEffect: vi.fn(),
}));
vi.mock('react-dom', () => ({ createPortal: (children: import('react').ReactNode) => children }));
afterEach(() => vi.unstubAllGlobals());
it('exposes disabled conversion and its reason as a native menu button', () => {
  vi.stubGlobal('document', { body: {} });
  const html = renderToStaticMarkup(ContextMenu({
    x: 0, y: 0, onClose: vi.fn(),
    items: [
      { label: 'View details', onClick: vi.fn() },
      { label: 'Convert lead…', onClick: vi.fn(), disabled: true, disabledReason: 'This lead is already converted.' },
    ],
  }));
  expect(html).toContain('role="menuitem"');
  expect(html).toContain('disabled="" title="This lead is already converted."');
  expect(html).toContain('aria-description="This lead is already converted."');
}));
