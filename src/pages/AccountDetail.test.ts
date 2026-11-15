import { createElement, isValidElement, ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const harness = vi.hoisted(() => ({ states: [] as unknown[], cursor: 0 }));
vi.mock('react', async (original) => ({
  ...await original<typeof import('react')>(),
  useEffect: () => undefined,
  useState: (initial: unknown) => {
    const index = harness.cursor++;
    if (!(index in harness.states)) harness.states[index] = initial;
    return [harness.states[index], (value: unknown) => { harness.states[index] = value; }];
  },
}));
vi.mock('react-router-dom', () => ({
  Link: ({ to, children }: { to: string; children: ReactNode }) => createElement('a', { href: to }, children),
  useNavigate: () => vi.fn(), useParams: () => ({ id: 'account-1' }),
}));
vi.mock('../components/Toast', () => ({ useToast: () => ({ push: vi.fn() }) }));
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ user: { role: 'admin' } }) }));
vi.mock('../hooks/useRecentlyViewed', () => ({ useRecentlyViewed: () => ({ recordView: vi.fn(), removeViews: vi.fn() }) }));
vi.mock('./Accounts', () => ({ canWriteAccounts: () => true }));
vi.mock('../components/CustomFieldsSection', () => ({ CustomFieldsSection: () => null }));
vi.mock('../components/Accordion', () => ({ Accordion: () => null }));
vi.mock('../components/RecordShell', () => ({
  RecordShell: ({ actions }: { actions: ReactNode }) => createElement('div', {}, actions),
}));
vi.mock('../components/Modal', () => ({
  Modal: ({ children, footer }: { children: ReactNode; footer: ReactNode }) => createElement('div', {}, children, footer),
}));

import { AccountDetail } from './AccountDetail';

interface Props { children?: ReactNode; 'data-testid'?: string; onClick?: () => void }
function nodes(node: ReactNode): import('react').ReactElement<Props>[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!isValidElement<Props>(node)) return [];
  return [node, ...nodes(node.props.children)];
}
const account = { id: 'account-1', name: 'Acme', industry: 'Tech', employees: 10, revenue: 1, phone: '', website: '' };
const contact = { id: 'contact-1', accountId: 'account-1' };
const DELETING = 7;
const CASCADE = 8;

beforeEach(() => {
  harness.cursor = 0;
  harness.states = [account, false, [contact], [], [], false, null, false, 'unlink'];
});

describe('AccountDetail delete dialog', () => {
  it('preselects unlink again after cascade was chosen, then Cancel and reopen', () => {
    harness.states[CASCADE] = 'cascade';
    harness.states[DELETING] = false;
    const tree = AccountDetail();
    nodes(tree).find((node) => node.props['data-testid'] === 'delete-account-btn')?.props.onClick?.();
    expect(harness.states[DELETING]).toBe(true);
    harness.cursor = 0;
    const html = renderToStaticMarkup(AccountDetail());
    expect(html).toMatch(/name="delete-mode"[^>]*checked=""[^>]*\/>Keep them/);
    expect(html).not.toMatch(/checked=""[^>]*\/>Delete the related/);
  });
});
