import { isValidElement, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LeadDetail } from './LeadDetail';
import { Lead, Role } from '../types';
import { LeadConvertWizard, WizardState } from './leads/LeadConvertWizard';

const harness = vi.hoisted(() => {
  const states: unknown[] = [];
  const refs: { current: boolean }[] = [];
  const effects: (() => void)[] = [];
  return {
    states, refs, effects, cursor: 0, refCursor: 0, role: 'admin',
    getLead: vi.fn(), request: vi.fn(), navigate: vi.fn(), toast: vi.fn(),
  };
});
vi.mock('react', async (original) => ({
  ...await original<typeof import('react')>(),
  useState: (initial: unknown) => {
    const index = harness.cursor++;
    if (!(index in harness.states)) harness.states[index] = initial;
    return [harness.states[index], (value: unknown) => { harness.states[index] = value; }];
  },
  useRef: (initial: boolean) => {
    const index = harness.refCursor++;
    return harness.refs[index] ?? (harness.refs[index] = { current: initial });
  },
  useEffect: (effect: () => void) => { harness.effects.push(effect); },
}));
vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'lead-58' }), useNavigate: () => harness.navigate,
  Link: () => null,
}));
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ user: { role: harness.role } }) }));
vi.mock('../hooks/useRecentlyViewed', () => ({ useRecentlyViewed: () => ({ recordView: vi.fn() }) }));
vi.mock('../components/Toast', () => ({ useToast: () => ({ push: harness.toast }) }));
vi.mock('../data/apiFetch', () => ({ apiFetch: (...args: unknown[]) => harness.request(...args) }));
vi.mock('../data/store', () => ({
  getById: (...args: unknown[]) => harness.getLead(...args), getAllSync: () => [],
  removeMany: vi.fn(), upsert: vi.fn(),
}));

interface NodeProps {
  children?: ReactNode;
  actions?: ReactNode;
  onClick?: () => unknown;
  wizard?: WizardState;
  setWizard?: (wizard: WizardState | null) => void;
  onFinish?: () => Promise<void>;
  isFinishing?: boolean;
  error?: string;
}
function nodes(node: ReactNode): import('react').ReactElement<NodeProps>[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!isValidElement<NodeProps>(node)) return [];
  return [node, ...nodes(node.props.children), ...nodes(node.props.actions)];
}
function render() {
  harness.cursor = 0;
  harness.refCursor = 0;
  harness.effects = [];
  return nodes(LeadDetail());
}
function action(label: string) {
  return render().find((node) => node.type === 'button' && node.props.children === label);
}
function conversion() {
  const node = render().find((item) => item.type === LeadConvertWizard);
  expect(node).toBeDefined();
  return node?.props;
}
const lead: Lead = {
  id: 'lead-58', name: 'Tara Iyer', company: 'Harbor', email: 'tara@example.com',
  phone: '123', status: 'Contacted', source: 'Web', ownerId: 'admin', value: 100,
  createdAt: '',
};
async function loadRecord(status: Lead['status'] = 'Contacted') {
  harness.getLead.mockResolvedValue({ ...lead, status });
  render();
  harness.effects[0]();
  await Promise.resolve();
}
beforeEach(() => {
  harness.states = [];
  harness.refs = [];
  harness.role = 'admin';
  harness.getLead.mockReset();
  harness.request.mockReset();
  harness.navigate.mockReset();
  harness.toast.mockReset();
});

describe('lead record conversion entry (AC21, approved Brain #148)', () => {
  it.each<Role>(['admin', 'rep', 'viewer'])('shows the native action only for writers: %s', async (role) => {
    harness.role = role;
    await loadRecord();
    expect(Boolean(action('Convert lead…'))).toBe(role !== 'viewer');
  });

  it('hides conversion for a converted record', async () => {
    await loadRecord('Converted');
    expect(action('Convert lead…')).toBeUndefined();
  });

  it('opens with lead defaults and closing makes no request', async () => {
    await loadRecord();
    action('Convert lead…')?.props.onClick?.();
    const props = conversion();
    expect(props?.wizard).toMatchObject({
      lead, step: 1, contactName: lead.name, contactEmail: lead.email, contactPhone: lead.phone,
      accountName: lead.company, dealAmount: lead.value, dealStage: 'Qualification',
    });
    props?.setWizard?.(null);
    expect(render().some((node) => node.type === LeadConvertWizard)).toBe(false);
    expect(harness.request).not.toHaveBeenCalled();
  });

  it('submits once, keeps entries on failure, and retries through the conversion endpoint', async () => {
    await loadRecord();
    action('Convert lead…')?.props.onClick?.();
    const initial = conversion()?.wizard;
    expect(initial).toBeDefined();
    if (!initial) throw new Error('Conversion did not open');
    conversion()?.setWizard?.({ ...initial, step: 3, contactName: 'Tara edited' });
    let rejectRequest: (error: Error) => void = () => undefined;
    harness.request.mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectRequest = reject; }));
    const pending = conversion()?.onFinish?.();
    expect(conversion()?.isFinishing).toBe(true);
    conversion()?.setWizard?.(null);
    await conversion()?.onFinish?.();
    expect(harness.request).toHaveBeenCalledTimes(1);
    rejectRequest(new Error('Connection failed'));
    await pending;
    expect(conversion()?.error).toBe('Connection failed');
    expect(conversion()?.wizard?.contactName).toBe('Tara edited');
    expect(conversion()?.isFinishing).toBe(false);
    expect(harness.navigate).not.toHaveBeenCalled();

    harness.request.mockResolvedValue({ lead: { ...lead, status: 'Converted' } });
    await conversion()?.onFinish?.();
    expect(harness.request).toHaveBeenLastCalledWith('/leads/lead-58/convert', {
      method: 'POST',
      body: JSON.stringify({
        accountMode: 'new', existingAccountId: '', accountName: 'Harbor',
        contactName: 'Tara edited', contactEmail: lead.email, contactPhone: '123',
        createDeal: false, dealName: 'Harbor New Business', dealAmount: 100, dealStage: 'Qualification',
      }),
    });
    expect(action('Convert lead…')).toBeUndefined();
    expect(render().some((node) => node.type === LeadConvertWizard)).toBe(false);
    expect(harness.toast).toHaveBeenCalledWith('success', 'Lead "Tara Iyer" converted successfully.');
    expect(harness.navigate).toHaveBeenCalledWith('/leads');
  });
});
