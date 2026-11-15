import { isValidElement, ReactElement, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountDetail } from './AccountDetail';
import { CampaignDetail } from './CampaignDetail';
import { DealDetail } from './DealDetail';
import { LeadDetail } from './LeadDetail';
import { ProductDetail } from './ProductDetail';
import { QuoteDetail } from './QuoteDetail';
import { TicketDetail } from './TicketDetail';

const harness = vi.hoisted(() => ({
  states: [] as unknown[],
  effects: [] as (() => void)[],
  cursor: 0,
  record: null as unknown,
  removeViews: vi.fn(),
  removeMany: vi.fn(),
  navigate: vi.fn(),
}));
vi.mock('react', async (original) => ({
  ...await original<typeof import('react')>(),
  useState: (initial: unknown) => {
    const index = harness.cursor++;
    if (!(index in harness.states)) harness.states[index] = initial;
    return [harness.states[index], (value: unknown) => { harness.states[index] = value; }];
  },
  useRef: (initial: unknown) => ({ current: initial }),
  useEffect: (effect: () => void) => { harness.effects.push(effect); },
}));
vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'rec-1' }), useNavigate: () => harness.navigate, Link: () => null,
}));
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ user: { role: 'admin' } }) }));
vi.mock('../hooks/useRecentlyViewed', () => ({
  useRecentlyViewed: () => ({ recordView: vi.fn(), removeViews: harness.removeViews }),
}));
vi.mock('../components/Toast', () => ({ useToast: () => ({ push: vi.fn() }) }));
vi.mock('../data/store', async (original) => ({
  ...await original<typeof import('../data/store')>(),
  getById: async () => harness.record,
  getAll: async () => [],
  getAllSync: () => [],
  removeMany: harness.removeMany,
  saveAll: vi.fn(),
  upsert: vi.fn(),
}));

interface NodeProps { children?: ReactNode; footer?: ReactNode; actions?: ReactNode; onClick?: () => unknown; 'data-testid'?: string }
function nodes(node: ReactNode): ReactElement<NodeProps>[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!isValidElement<NodeProps>(node)) return [];
  return [node, ...nodes(node.props.children), ...nodes(node.props.footer), ...nodes(node.props.actions)];
}

const modules: { name: string; page: () => ReactNode; record: object }[] = [
  { name: 'leads', page: LeadDetail, record: { id: 'rec-1', name: 'Tara', company: 'Harbor', email: 'a@b.c', phone: '1', status: 'New', source: 'Web', ownerId: 'admin', value: 1, createdAt: '' } },
  { name: 'accounts', page: AccountDetail, record: { id: 'rec-1', name: 'Zenith', industry: 'Tech', employees: 1, revenue: 1, website: '', phone: '', ownerId: 'admin', createdAt: '' } },
  { name: 'deals', page: DealDetail, record: { id: 'rec-1', name: 'Big deal', accountId: null, amount: 1, stage: 'Qualification', closeDate: '', probability: 10, ownerId: 'admin', createdAt: '' } },
  { name: 'products', page: ProductDetail, record: { id: 'rec-1', name: 'Widget', sku: 'W-1', category: 'Hardware', price: 1, description: '', active: true, createdAt: '' } },
  { name: 'quotes', page: QuoteDetail, record: { id: 'rec-1', quoteNumber: 'Q-1', accountId: 'a1', lineItems: [], status: 'Draft', validUntil: '', createdAt: '' } },
  { name: 'campaigns', page: CampaignDetail, record: { id: 'rec-1', name: 'Spring', channel: 'Email', budget: 1, startDate: '', endDate: '', status: 'Planned', createdAt: '' } },
];

function render(page: () => ReactNode) {
  harness.cursor = 0;
  harness.effects = [];
  return nodes(page());
}
async function load(page: () => ReactNode) {
  render(page);
  harness.effects[0]();
  await new Promise((resolve) => setTimeout(resolve, 0));
}
function confirmDelete(page: () => ReactNode) {
  const flags = harness.states.flatMap((value, index) => (value === false ? [index] : []));
  for (const index of flags) {
    harness.states[index] = true;
    const button = render(page).find((node) => node.props['data-testid'] === 'confirm-delete-btn');
    if (button) return button;
    harness.states[index] = false;
  }
  throw new Error('Delete confirmation did not open');
}

beforeEach(() => {
  harness.states = [];
  harness.record = null;
  harness.removeViews.mockReset();
  harness.removeMany.mockReset();
  harness.navigate.mockReset();
});

describe('Recently Accessed drops records that no longer exist (AIO-419)', () => {
  it.each([...modules.map((m) => [m.name, m.page] as const), ['tickets', TicketDetail] as const])(
    'removes the row when a %s detail page reports not found',
    async (_name, page) => {
      await load(page);
      expect(harness.removeViews).toHaveBeenCalledWith(['rec-1']);
    },
  );

  it.each(modules.map((m) => [m.name, m.page, m.record] as const))(
    'removes the row when a %s record is deleted',
    async (_name, page, record) => {
      harness.record = record;
      await load(page);
      expect(harness.removeViews).not.toHaveBeenCalled();
      await confirmDelete(page).props.onClick?.();
      expect(harness.removeMany).toHaveBeenCalled();
      expect(harness.removeViews).toHaveBeenCalledWith(['rec-1']);
    },
  );
});
