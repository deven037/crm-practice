import { isValidElement, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Leads, LEAD_TOOLBOX_LINKS, leadFlow } from './Leads';
import { Lead } from '../types';
import { LeadsTable } from './leads/LeadsTable';
import { LeadConvertWizard, WizardState } from './leads/LeadConvertWizard';
import { ContextMenu, ContextMenuItem } from '../components/ContextMenu';
import { ToolBoxMenu } from '../components/ToolBoxMenu';
import { StatusPicker, filterStatuses, statusClass, toggleStatus } from './leads/StatusPicker';

const harness = vi.hoisted(() => ({
  ...(() => { const states: unknown[] = []; const effects: (() => void)[] = []; return { states, effects }; })(), cursor: 0,
  role: 'admin', getAll: vi.fn(), navigate: vi.fn(),
}));
vi.mock('react', async (original) => ({
  ...await original<typeof import('react')>(),
  useState: (initial: unknown) => {
    const index = harness.cursor++;
    if (!(index in harness.states)) harness.states[index] = initial;
    return [harness.states[index], (value: unknown) => { harness.states[index] = value; }];
  },
  useRef: (initial: unknown) => ({ current: initial }),
  useMemo: (compute: () => unknown) => compute(),
  useEffect: (effect: () => void) => { harness.effects.push(effect); },
}));
vi.mock('react-router-dom', () => ({
  Link: () => null, useNavigate: () => harness.navigate,
  useLocation: () => ({}), useSearchParams: () => [new URLSearchParams(), vi.fn()],
}));
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ user: { role: harness.role } }) }));
vi.mock('../components/Toast', () => ({ useToast: () => ({ push: vi.fn() }) }));
vi.mock('../data/store', () => ({
  getAll: (...args: unknown[]) => harness.getAll(...args), getAllSync: () => [],
  newId: vi.fn(), removeMany: vi.fn(), saveAll: vi.fn(), upsert: vi.fn(),
}));
vi.mock('../hooks/useRecentlyViewed', () => ({ useRecentlyViewed: () => ({ items: [] }) }));
interface Props {
  module?: string;
  links?: { label: string; to: string }[];
  'data-testid'?: string;
  children?: ReactNode;
  onClick?: () => void;
  onChange?: () => void;
  onContextMenu?: (event: { preventDefault: () => void; stopPropagation: () => void; clientX: number; clientY: number }, lead: Lead) => void;
  items?: ContextMenuItem[];
  wizard?: WizardState;
  title?: string;
  to?: string;
  checked?: boolean;
}
function nodes(node: ReactNode): import('react').ReactElement<Props>[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!isValidElement<Props>(node)) return [];
  return [node, ...nodes(node.props.children)];
}
function render() {
  harness.cursor = 0;
  harness.effects = [];
  return nodes(Leads());
}
const lead: Lead = {
  id: 'lead-58', name: 'Tara Iyer', company: 'Harbor', email: 'tara@example.com',
  phone: '123', status: 'New', source: 'Web', ownerId: 'admin', value: 100, createdAt: '',
};
async function load() {
  harness.getAll.mockImplementation((key: string) => Promise.resolve(key === 'leads' ? [lead] : []));
  render();
  harness.effects[0]();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}
function openMenu(record: Lead) {
  render().find((node) => node.type === LeadsTable)?.props.onContextMenu?.({
    preventDefault: vi.fn(), stopPropagation: vi.fn(), clientX: 20, clientY: 20,
  }, record);
  return render().find((node) => node.type === ContextMenu)?.props.items;
}
beforeEach(() => { harness.states = []; harness.role = 'admin'; harness.getAll.mockReset(); });

describe('AIO-411 restored controls', () => {
  it.each(['admin', 'rep', 'viewer'])('keeps every ToolBox link behind the ToolBox button: %s', async (role) => {
    harness.role = role;
    await load();
    const menu = render().find((node) => node.type === ToolBoxMenu);
    expect(menu?.props.links).toEqual([
      { label: 'Assignment Rules', to: '/setup/assignment-rules' },
      { label: 'Dedupe Rule', to: '/setup/dedupe-rules' },
      { label: 'Status Codes', to: '/setup/status-codes' },
      { label: 'Import Data', to: '/setup/import' },
      { label: 'Custom Fields', to: '/admin/objects/leads' },
      { label: 'Customise Page Layout', to: '/setup/layouts/leads' },
    ]);
    expect(menu?.props.links).toBe(LEAD_TOOLBOX_LINKS);
  });

  it('opens conversion from the row menu and traverses all four wizard steps', async () => {
    await load();
    const item = openMenu(lead)?.find((entry) => entry.label === 'Convert lead…');
    expect(item?.disabled).toBe(false);
    item?.onClick();
    const entry = render().find((node) => node.type === LeadConvertWizard)?.props.wizard;
    expect(entry).toMatchObject({ lead, step: 1, contactName: lead.name });
    if (!entry) throw new Error('Wizard did not open');
    let wizard: WizardState | null = entry;
    const setWizard = (next: WizardState | null) => { wizard = next; };
    for (const step of [1, 2, 3, 4]) {
      if (!wizard) throw new Error('Wizard closed unexpectedly');
      const page = nodes(LeadConvertWizard({
        wizard, setWizard, accounts: [], onFinish: vi.fn(), isFinishing: false,
      }));
      expect(page[0].props.title).toBe(`Convert lead — Step ${step} of 4`);
      if (step < 4) page.find((node) => node.props.children === 'Next ›')?.props.onClick?.();
      else expect(page.some((node) => node.props.children === 'Finish conversion')).toBe(true);
    }
  });

  it('disables Converted conversion with its reason and keeps the guard', async () => {
    await load();
    const item = openMenu({ ...lead, status: 'Converted' })?.find((entry) => entry.label === 'Convert lead…');
    expect(item?.disabled).toBe(true);
    expect(item?.disabledReason).toBe('This lead is already converted.');
    item?.onClick();
    expect(render().some((node) => node.type === LeadConvertWizard)).toBe(false);
  });

  it('the status filter adds and removes statuses without dropping another selection', async () => {
    expect(toggleStatus(['New'], 'Qualified')).toEqual(['New', 'Qualified']);
    expect(toggleStatus(['New', 'Qualified'], 'New')).toEqual(['Qualified']);
    expect(toggleStatus(['New'], 'New')).toEqual([]);
    await load();
    const picker = render().find((node) => node.type === StatusPicker);
    expect(picker?.props).toMatchObject({ multi: true, selected: [], label: 'Filter by status' });
  });

  it('finds a status by part of its name, including one a bank added', () => {
    expect(filterStatuses(['New', 'KYC pending', 'Call back'], 'kyc')).toEqual(['KYC pending']);
    expect(filterStatuses(['New', 'Qualified'], '  ')).toEqual(['New', 'Qualified']);
    expect(filterStatuses(['New'], 'zzz')).toEqual([]);
    expect(statusClass('KYC pending')).toBe('status-kyc-pending');
  });

  it('counts leads in each standard status for the bar above the list', () => {
    const flow = leadFlow([{ status: 'New' }, { status: 'New' }, { status: 'Converted' }]);
    expect(flow.map((step) => step.status)).toEqual(['New', 'Contacted', 'Qualified', 'Unqualified', 'Converted']);
    expect(flow.map((step) => step.count)).toEqual([2, 0, 0, 0, 1]);
  });

  it('has no shared filter panel toggle and keeps its own New lead button', async () => {
    await load();
    const page = render();
    expect(page.some((node) => node.props['data-testid'] === 'filters-toggle')).toBe(false);
    expect(page.some((node) => node.props['data-testid'] === 'new-lead-btn')).toBe(true);
  });
});
