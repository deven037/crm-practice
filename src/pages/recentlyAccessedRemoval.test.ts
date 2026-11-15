import { ComponentProps, isValidElement, ReactElement, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountDetail } from './AccountDetail';
import { CampaignDetail } from './CampaignDetail';
import { DealDetail } from './DealDetail';
import { LeadDetail } from './LeadDetail';
import { ProductDetail } from './ProductDetail';
import { QuoteDetail } from './QuoteDetail';
import { TicketDetail } from './TicketDetail';
import { Tickets } from './Tickets';
import { TicketReadingPane } from '../components/TicketReadingPane';
import { Ticket } from '../types';

const harness = vi.hoisted(() => ({
  states: [] as unknown[],
  effects: [] as (() => void)[],
  cursor: 0,
  record: null as unknown,
  tickets: [] as unknown[],
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
  useMemo: (factory: () => unknown) => factory(),
  useRef: (initial: unknown) => ({ current: initial }),
  useEffect: (effect: () => void) => { harness.effects.push(effect); },
}));
vi.mock('react-router-dom', () => ({
  useSearchParams: () => [new URLSearchParams()],
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
  getAll: async () => harness.tickets,
  getAllSync: () => [],
  removeMany: harness.removeMany,
  saveAll: vi.fn(),
  upsert: vi.fn(),
}));

interface NodeProps { children?: ReactNode; footer?: ReactNode; actions?: ReactNode; list?: ReactNode; detail?: ReactNode; onClick?: () => unknown; 'data-testid'?: string }
function nodes(node: ReactNode): ReactElement<NodeProps>[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!isValidElement<NodeProps>(node)) return [];
  return [node, ...nodes(node.props.children), ...nodes(node.props.footer), ...nodes(node.props.actions), ...nodes(node.props.list), ...nodes(node.props.detail)];
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
  harness.tickets = [];
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

const closedTicket: Ticket = {
  id: 'rec-1', subject: 'Dashboard loads slowly', description: '', requester: 'Admin',
  priority: 'Medium', status: 'Closed', slaDue: '', createdAt: '', comments: [], attachments: [],
};

async function ticketDeleteButton(page: () => ReactNode) {
  harness.record = closedTicket;
  harness.tickets = [closedTicket];
  await load(page);
  if (page === Tickets) {
    render(page).find((node) => node.props['data-testid'] === 'ticket-inbox-row-rec-1')?.props.onClick?.();
  }
  const pane = render(page).find((node) => node.type === TicketReadingPane);
  if (!isValidElement<ComponentProps<typeof TicketReadingPane>>(pane)) throw new Error('Ticket pane missing');
  harness.states = [];
  const renderPane = () => TicketReadingPane(pane.props);
  render(renderPane).find((node) => node.props['data-testid'] === 'delete-ticket-btn')?.props.onClick?.();
  const confirm = render(renderPane).find((node) => node.props['data-testid'] === 'confirm-delete-btn');
  if (!confirm?.props.onClick) throw new Error('Ticket delete confirmation missing');
  return confirm.props.onClick;
}

describe('Ticket delete removes Recently Accessed from both callers (AIO-422)', () => {
  it.each([['detail', TicketDetail], ['inbox', Tickets]] as const)(
    'removes the row only after successful deletion from %s',
    async (_name, page) => {
      const confirm = await ticketDeleteButton(page);
      let finishDelete: () => void = () => {};
      harness.removeMany.mockImplementation(() => new Promise<void>((resolve) => { finishDelete = resolve; }));
      const pending = confirm();
      expect(harness.removeMany).toHaveBeenCalledWith('tickets', ['rec-1']);
      expect(harness.removeViews).not.toHaveBeenCalled();
      finishDelete();
      await pending;
      expect(harness.removeViews).toHaveBeenCalledTimes(1);
      expect(harness.removeViews).toHaveBeenCalledWith(['rec-1']);
      if (page === TicketDetail) expect(harness.navigate).toHaveBeenCalledWith('/tickets');
    },
  );

  it.each([['detail', TicketDetail], ['inbox', Tickets]] as const)(
    'keeps the row when deletion fails from %s',
    async (_name, page) => {
      const confirm = await ticketDeleteButton(page);
      harness.removeMany.mockRejectedValueOnce(new Error('Delete failed'));
      await expect(confirm()).rejects.toThrow('Delete failed');
      expect(harness.removeViews).not.toHaveBeenCalled();
      expect(harness.navigate).not.toHaveBeenCalled();
    },
  );
});
