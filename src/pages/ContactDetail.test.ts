import { createElement, isValidElement, ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const harness = vi.hoisted(() => ({
  states: [] as unknown[], cursor: 0, role: 'admin',
}));
vi.mock('react', async (original) => ({
  ...await original<typeof import('react')>(),
  useEffect: () => {},
  useRef: () => ({ current: null }),
  useState: (initial: unknown) => {
    const index = harness.cursor++;
    if (!(index in harness.states)) harness.states[index] = initial;
    return [harness.states[index], (value: unknown) => { harness.states[index] = value; }];
  },
}));
vi.mock('react-router-dom', () => ({
  Link: ({ to, children }: { to: string; children: ReactNode }) => createElement('a', { href: to }, children),
  useNavigate: () => vi.fn(), useParams: () => ({ id: 'contact-1' }),
}));
vi.mock('../data/store', () => ({ getAllSync: () => [], upsert: vi.fn(), removeMany: vi.fn(), newId: () => 'note-1' }));
vi.mock('../components/Toast', () => ({ useToast: () => ({ push: vi.fn() }) }));
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ user: { role: harness.role } }) }));
vi.mock('../hooks/useRecentlyViewed', () => ({ useRecentlyViewed: () => ({ recordView: vi.fn() }) }));
vi.mock('../components/Select', () => ({ MultiSelect: () => null, SearchableSelect: () => null }));
vi.mock('../components/CustomFieldsSection', () => ({ CustomFieldsSection: () => null, validateCustomFields: () => ({}) }));
vi.mock('../components/Tabs', () => ({ Tabs: ({ tabs }: { tabs: { content: ReactNode }[] }) => createElement('div', {}, tabs.map((tab, index) => createElement('section', { key: index }, tab.content))) }));

import { ContactDetail } from './ContactDetail';
import { upsert } from '../data/store';
interface Props {
  children?: ReactNode;
  tabs?: { content: ReactNode }[];
  'data-testid'?: string;
  onSubmit?: (event: { preventDefault: () => void }) => Promise<void>;
}
function nodes(node: ReactNode): import('react').ReactElement<Props>[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!isValidElement<Props>(node)) return [];
  return [node, ...nodes(node.props.children), ...(node.props.tabs ?? []).flatMap((tab) => nodes(tab.content))];
}
const contact = {
  id: 'contact-1', name: 'Amara', email: 'amara@example.com', phone: '', title: '',
  accountId: null, avatar: null, tags: [], notes: [], files: [], createdAt: '2026-10-01', layoutName: null,
};
beforeEach(() => {
  vi.clearAllMocks();
  harness.cursor = 0; harness.role = 'admin';
  harness.states = [contact, false, { ...contact }, true, '', false];
});
describe('ContactDetail save states', () => {
  it('rejects invalid email before persistence', async () => {
    harness.states[2] = { ...contact, email: 'invalid' };
    const tree = ContactDetail();
    await nodes(tree).find((node) => node.type === 'form')?.props.onSubmit?.({ preventDefault: vi.fn() });
    harness.cursor = 0;
    const html = renderToStaticMarkup(ContactDetail());
    expect(html).toContain('Enter a valid email.');
    expect(html).toContain('aria-describedby="edit-contact-email-error"');
    expect(upsert).not.toHaveBeenCalled();
  });
  it('preserves edit mode and draft after network rejection', async () => {
    vi.mocked(upsert).mockRejectedValueOnce(new Error('Network failure'));
    const tree = ContactDetail();
    await nodes(tree).find((node) => node.type === 'form')?.props.onSubmit?.({ preventDefault: vi.fn() });
    harness.cursor = 0;
    const html = renderToStaticMarkup(ContactDetail());
    expect(html).toContain('Changes couldn’t be saved. Your details are still here.');
    expect(html).toContain('value="amara@example.com"');
    expect(harness.states[3]).toBe(true);
    expect(html.match(/<form[\s\S]*?<\/form>/)?.[0]).not.toContain('disabled=""');
  });
  it('hides write actions for viewers and shows the notes empty state', () => {
    harness.role = 'viewer'; harness.states[3] = false;
    const html = renderToStaticMarkup(ContactDetail());
    expect(html).toMatch(/hidden=""[^>]*data-testid="edit-contact-btn"/);
    expect(html).toMatch(/hidden=""[^>]*data-testid="delete-contact-btn"/);
    expect(html).not.toContain('data-testid="note-input"');
    expect(html).toContain('No notes yet.');
  });
});
