import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, expect, it, vi } from 'vitest';
import { Modal, trapTarget } from './Modal';

vi.mock('react', async (original) => ({
  ...await original<typeof import('react')>(), useEffect: vi.fn(),
}));
vi.mock('react-dom', () => ({ createPortal: (children: import('react').ReactNode) => children }));
afterEach(() => vi.unstubAllGlobals());

it('labels the dialog, makes it focusable and describes it by its body', () => {
  vi.stubGlobal('document', { body: {} });
  const html = renderToStaticMarkup(createElement(Modal, { title: 'Delete Acme?', onClose: vi.fn(), children: 'This cannot be undone.' }));
  const describedBy = /aria-describedby="([^"]+)"/.exec(html)?.[1];
  expect(html).toContain('tabindex="-1"');
  expect(html).toContain('aria-modal="true"');
  expect(describedBy).toBeTruthy();
  expect(html).toContain(`class="modal-body" id="${describedBy}"`);
});

it('wraps Tab from the last control to the first and Shift+Tab the other way', () => {
  const dialog = 'dialog';
  const controls = ['close', 'cancel', 'delete'];
  expect(trapTarget(controls, dialog, 'delete', false)).toBe('close');
  expect(trapTarget(controls, dialog, 'close', true)).toBe('delete');
  expect(trapTarget(controls, dialog, dialog, true)).toBe('delete');
  expect(trapTarget(controls, dialog, 'cancel', false)).toBeNull();
  expect(trapTarget([], dialog, dialog, false)).toBe(dialog);
});
