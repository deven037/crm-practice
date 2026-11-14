import { isValidElement, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Leads } from './Leads';
import { Lead } from '../types';
import { LeadsTable } from './leads/LeadsTable';
import { LeadConvertWizard, WizardState } from './leads/LeadConvertWizard';
import { ContextMenu, ContextMenuItem } from '../components/ContextMenu';
import { LeadFilterPanel } from './leads/LeadFilterPanel';

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
interface Props {
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
  it.each(['admin', 'rep', 'viewer'])('exposes setup shortcuts to writers: %s', async (role) => {
    harness.role = role;
    await load();
    const links = render().filter((node) => node.props.to?.startsWith('/setup/'));
    expect(links.map((node) => node.props.to)).toEqual(role === 'viewer' ? [] : [
      '/setup/assignment-rules', '/setup/status-codes',
    ]);
  });

  it('opens conversion from the row menu and traverses all three wizard steps', async () => {
    await load();
    const item = openMenu(lead)?.find((entry) => entry.label === 'Convert lead…');
    expect(item?.disabled).toBe(false);
    item?.onClick();
    const entry = render().find((node) => node.type === LeadConvertWizard)?.props.wizard;
    expect(entry).toMatchObject({ lead, step: 1, contactName: lead.name });
    if (!entry) throw new Error('Wizard did not open');
    let wizard: WizardState | null = entry;
    const setWizard = (next: WizardState | null) => { wizard = next; };
    for (const step of [1, 2, 3]) {
      if (!wizard) throw new Error('Wizard closed unexpectedly');
      const page = nodes(LeadConvertWizard({
        wizard, setWizard, accounts: [], onFinish: vi.fn(), isFinishing: false,
      }));
      expect(page[0].props.title).toBe(`Convert lead — Step ${step} of 3`);
      if (step < 3) page.find((node) => node.props.children === 'Next ›')?.props.onClick?.();
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

  it('status chips add and remove filters without dropping another selection', () => {
    const onStatusChange = vi.fn();
    const page = nodes(LeadFilterPanel({
      statusFilter: ['New'], statusOptions: ['New', 'Qualified'], sourceFilter: '',
      ownerFilter: '', ownerOptions: [], onStatusChange,
      onSourceChange: vi.fn(), onOwnerChange: vi.fn(), onClear: vi.fn(),
    }));
    const inputs = page.filter((node) => node.type === 'input');
    expect(inputs.map((node) => node.props.checked)).toEqual([true, false]);
    inputs[1].props.onChange?.();
    expect(onStatusChange).toHaveBeenLastCalledWith(['New', 'Qualified']);
    inputs[0].props.onChange?.();
    expect(onStatusChange).toHaveBeenLastCalledWith([]);
  });
});
