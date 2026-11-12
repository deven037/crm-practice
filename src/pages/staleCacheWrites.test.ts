import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isValidElement, ReactElement, ReactNode } from 'react';
import { AccountDetail } from './AccountDetail';
import { ProductDetail } from './ProductDetail';
import { Leads } from './Leads';
import { Account, Contact, Deal, Lead, Product } from '../types';

const harness = vi.hoisted(() => {
  const states: unknown[] = [];
  return { states, cursor: 0,
    read: vi.fn(), cached: vi.fn(), save: vi.fn(), remove: vi.fn(), rule: vi.fn(),
  };
});
vi.mock('react', async (original) => ({
  ...await original<typeof import('react')>(),
  useState: (initial: unknown) => {
    const index = harness.cursor++;
    if (!(index in harness.states)) harness.states[index] = initial;
    return [harness.states[index], (value: unknown) => {
      harness.states[index] = typeof value === 'function' ? value(harness.states[index]) : value;
    }];
  },
  useEffect: () => undefined,
  useMemo: (factory: () => unknown) => factory(),
  useRef: (value: unknown) => ({ current: value }),
}));
vi.mock('react-router-dom', async (original) => ({
  ...await original<typeof import('react-router-dom')>(),
  useParams: () => ({ id: 'a1' }),
  useNavigate: () => vi.fn(),
  useLocation: () => ({ state: null }),
  useSearchParams: () => [new URLSearchParams(), vi.fn()],
}));
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ user: { role: 'admin' } }) }));
vi.mock('../components/Toast', () => ({ useToast: () => ({ push: vi.fn() }) }));
vi.mock('../hooks/useRecentlyViewed', () => ({ useRecentlyViewed: () => ({ recordView: vi.fn() }) }));
vi.mock('../utils/rules', () => ({
  applyAssignmentRule: (...args: unknown[]) => harness.rule(...args),
  getStatusOptions: (_module: string, _field: string, fallback: string[]) => fallback,
}));
vi.mock('../data/store', () => ({
  getAll: (...args: unknown[]) => harness.read(...args),
  getAllSync: (...args: unknown[]) => harness.cached(...args),
  saveAll: (...args: unknown[]) => harness.save(...args),
  removeMany: (...args: unknown[]) => harness.remove(...args),
  getById: vi.fn(), upsert: vi.fn(), newId: vi.fn(),
}));
interface Props {
  children?: ReactNode;
  footer?: ReactNode;
  onClick?: () => Promise<unknown>;
  onApply?: (field: string, value: string) => Promise<void>;
  'data-testid'?: string;
}
function nodes(node: ReactNode): ReactElement<Props>[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!isValidElement<Props>(node)) return [];
  return [node, ...nodes(node.props.children), ...nodes(node.props.footer)];
}
function action(tree: ReactNode, testId: string) {
  const button = nodes(tree).find((node) => node.props['data-testid'] === testId);
  if (!button?.props.onClick) throw new Error('Missing action ' + testId);
  return button.props.onClick();
}
const account: Account = {
  id: 'a1', name: 'Harbor', industry: 'Technology', employees: 1,
  revenue: 0, website: '', phone: '', ownerId: 'u1', createdAt: '',
};
const contact: Contact = {
  id: 'c1', name: 'Mina', email: 'mina@example.com', phone: '', accountId: 'a1',
  title: 'Director', tags: [], avatar: null, notes: [], files: [], createdAt: '',
};
const deal: Deal = {
  id: 'd1', name: 'Pilot', accountId: 'a1', amount: 100, stage: 'Closed Lost',
  probability: 0, closeDate: '', ownerId: 'u1', createdAt: '',
};
const product: Product = {
  id: 'p1', name: 'Service', sku: 'S1', category: 'Service', price: 100,
  description: '', active: true, createdAt: '',
};
const lead: Lead = {
  id: 'l1', name: 'Mina', company: 'Harbor', email: 'mina@example.com', phone: '',
  status: 'New', source: 'Web', ownerId: 'u1', value: 100, productId: 'p1', createdAt: '',
};
beforeEach(() => {
  harness.states = [];
  harness.cursor = 0;
  vi.clearAllMocks();
  harness.cached.mockReturnValue([]);
  harness.read.mockResolvedValue([]);
  harness.save.mockResolvedValue([]);
  harness.remove.mockResolvedValue(undefined);
  harness.rule.mockReturnValue(null);
});
describe('AIO-401 fresh affected-record writes', () => {
  it.each([false, true])('account unlink delegates to guarded DELETE (empty stale relation list: %s)', async (empty) => {
    harness.states = [account, false, empty ? [] : [contact], empty ? [] : [deal], [], false, null, true];
    await action(AccountDetail(), 'confirm-delete-btn');
    expect(harness.read).not.toHaveBeenCalled();
    expect(harness.save).not.toHaveBeenCalled();
    expect(harness.remove.mock.calls).toEqual([['accounts', ['a1']]]);
  });

  it.each([false, true])('product unlink preserves fresh lead fields (empty stale relation list: %s)', async (empty) => {
    harness.states = [product, false, empty ? [] : [lead], [], false, null, true, product.name];
    const fresh = { ...lead, status: 'Qualified', phone: 'new phone', customFields: { region: 'West' } };
    harness.cached.mockReturnValue([lead]);
    harness.read.mockResolvedValue([fresh, { ...lead, id: 'l2', productId: 'p2' }]);
    await action(ProductDetail(), 'confirm-delete-btn');
    expect(harness.read).toHaveBeenCalledWith('leads');
    expect(harness.save.mock.calls).toEqual([['leads', [{ ...fresh, productId: null }]]]);
    expect(harness.remove).toHaveBeenCalledWith('products', ['p1']);
  });

  function leadsTree() {
    // Existing page state order, matching the Contacts component-action test harness.
    harness.states = [
      false, false, [lead, { ...lead, id: 'l2' }], [], 'table', '', '', [], '', '',
      false, 'createdAt', 'desc', 1, 10, ['l1'], false, null, null, true, 'u2', true, false,
    ];
    return Leads();
  }
  it('bulk assign writes selected fresh leads only and keeps concurrent fields', async () => {
    const tree = leadsTree();
    const fresh = { ...lead, phone: 'new phone', status: 'Qualified', customFields: { region: 'West' } };
    harness.read.mockResolvedValue([fresh, { ...lead, id: 'l2', value: 500 }]);
    const button = nodes(tree).find((node) => node.type === 'button' && Array.isArray(node.props.children)
      && node.props.children[0] === 'Assign ');
    if (!button?.props.onClick) throw new Error('Missing assign action');
    await button.props.onClick();
    expect(harness.read).toHaveBeenCalledWith('leads');
    expect(harness.save.mock.calls).toEqual([['leads', [{ ...fresh, ownerId: 'u2' }]]]);
  });

  it('mass update evaluates assignment on fresh selected records and preserves other fields', async () => {
    const tree = leadsTree();
    const fresh = { ...lead, company: 'Updated company', value: 800, customFields: { region: 'West' } };
    harness.read.mockResolvedValue([fresh, { ...lead, id: 'l2', phone: 'new phone' }]);
    harness.rule.mockReturnValue('rule-owner');
    const modal = nodes(tree).find((node) => node.props.onApply);
    if (!modal?.props.onApply) throw new Error('Missing mass update action');
    await modal.props.onApply('status', 'Qualified');
    const updated = { ...fresh, status: 'Qualified' };
    expect(harness.rule.mock.calls).toEqual([['leads', updated]]);
    expect(harness.save.mock.calls).toEqual([['leads', [{ ...updated, ownerId: 'rule-owner' }]]]);
  });

  it.each([false, true])('account remains when a fresh open deal blocks DELETE (empty stale relation list: %s)', async (empty) => {
    harness.states = [account, false, [contact], empty ? [] : [deal], [], false, null, true];
    const serverAccounts = new Map([[account.id, account]]);
    const freshDeal = { ...deal, stage: 'Proposal' };
    harness.remove.mockImplementation(async (key: string, ids: string[]) => {
      if (key === 'accounts' && freshDeal.accountId === account.id && !freshDeal.stage.startsWith('Closed')) {
        throw new Error('Account has 1 open deal(s). Close or reassign them first.');
      }
      ids.forEach((id) => serverAccounts.delete(id));
    });
    await action(AccountDetail(), 'confirm-delete-btn');
    expect(harness.remove.mock.calls).toEqual([['accounts', ['a1']]]);
    expect(harness.read).not.toHaveBeenCalled();
    expect(harness.save).not.toHaveBeenCalled();
    expect(serverAccounts.get(account.id)).toEqual(account);
    expect(freshDeal.accountId).toBe(account.id);
    expect(harness.states[10]).toBe(true);
    expect(harness.states[9]).toBe(false);
  });
});
