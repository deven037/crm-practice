import { createElement, isValidElement, ReactElement, ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Deals, DealModal } from './Deals';
import { Deal } from '../types';

const harness = vi.hoisted(() => ({
  states: [] as unknown[], cursor: 0, validation: {} as Record<string, string>,
  effects: [] as (() => void)[], request: vi.fn(), remove: vi.fn(),
}));
vi.mock('react', async (original) => ({
  ...await original<typeof import('react')>(),
  useState: (initial: unknown) => {
    const index = harness.cursor++;
    if (!(index in harness.states)) harness.states[index] = initial;
    return [harness.states[index], (next: unknown) => {
      harness.states[index] = typeof next === 'function' ? next(harness.states[index]) : next;
    }];
  },
  useEffect: (effect: () => void) => { harness.effects.push(effect); },
  useRef: () => ({ current: null }),
}));
vi.mock('../components/Modal', () => ({
  Modal: ({ children, footer }: { children: ReactNode; footer: ReactNode }) => createElement('section', null, children, footer),
}));
vi.mock('../components/Select', () => ({ Select: () => null, SearchableSelect: () => null }));
vi.mock('../components/DatePicker', () => ({ DatePicker: () => null }));
vi.mock('../components/CustomFieldsSection', () => ({
  validateCustomFields: () => harness.validation,
  CustomFieldsSection: ({ errors }: { errors: Record<string, string> }) => createElement('span', null, Object.values(errors).join(' ')),
}));
vi.mock('../utils/rules', () => ({ getStatusOptions: () => [], applyAssignmentRule: () => null }));

vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ user: { role: 'rep' } }) }));
vi.mock('../components/Toast', () => ({ useToast: () => ({ push: vi.fn() }) }));
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn(), useSearchParams: () => [new URLSearchParams()], Link: () => null }));
vi.mock('../data/store', () => ({ getAll: (key: string) => harness.request(key), upsert: vi.fn(), removeMany: (...args: unknown[]) => harness.remove(...args) }));

interface Props {
  onClick?: () => Promise<void>;
  onCardClick?: (deal: Deal) => void;
  children?: ReactNode;
  footer?: ReactNode;
  onSubmit?: (event: { preventDefault: () => void }) => void;
  onChange?: (event: { target: { value: string } }) => void;
  onDelete?: (deal: Deal) => void;
  disabled?: boolean;
  'data-testid'?: string;
}
function nodes(node: ReactNode): ReactElement<Props>[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!isValidElement<Props>(node)) return [];
  return [node, ...nodes(node.props.children), ...nodes(node.props.footer)];
}
const deal: Deal = { id: 'd1', name: 'Custody', accountId: null, amount: 400, stage: 'Qualification', closeDate: '', probability: 50, ownerId: 'u1', createdAt: '' };
const save = vi.fn<(deal: Deal) => Promise<void>>();
function render() {
  harness.cursor = 0;
  const tree = DealModal({ deal, accounts: [], users: [], onCancel: vi.fn(), onSave: save, onDelete: vi.fn() });
  const elements = nodes(tree);
  return { submit: () => elements.find((node) => node.type === 'form')?.props.onSubmit?.({ preventDefault: vi.fn() }), html: renderToStaticMarkup(tree), elements, saveButton: elements.find((node) => node.props['data-testid'] === 'deal-save-btn') };
}
beforeEach(() => { harness.states = []; harness.cursor = 0; harness.validation = {}; save.mockReset(); harness.effects = []; harness.request.mockReset(); harness.remove.mockReset(); });

describe('board edit dialog', () => {
  it('blocks a blank name and reports required custom fields without saving', async () => {
    render().elements.find((node) => node.props['data-testid'] === 'deal-name')?.props.onChange?.({ target: { value: '' } });
    harness.validation = { fleet: 'Fleet size is required.' };
    render().submit();
    await Promise.resolve();
    const html = render().html;
    expect(html).toContain('Deal name is required.');
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('Fleet size is required.');
    expect(save).not.toHaveBeenCalled();
  });
  it('blocks saving with a missing required custom field even when the name is valid', async () => {
    harness.validation = { fleet: 'Fleet size is required.' };
    render().submit();
    await Promise.resolve();
    expect(save).not.toHaveBeenCalled();
    expect(render().html).toContain('Fleet size is required.');
  });
  it('disables repeat saves in flight and retains the draft when the server rejects it', async () => {
    let rejectSave: (error: Error) => void = () => undefined;
    save.mockImplementation(() => new Promise<void>((_resolve, reject) => { rejectSave = reject; }));
    render().elements.find((node) => node.props['data-testid'] === 'deal-name')?.props.onChange?.({ target: { value: 'Updated custody' } });
    render().submit();
    expect(render().saveButton?.props.disabled).toBe(true);
    render().submit();
    await Promise.resolve();
    expect(save).toHaveBeenCalledTimes(1);
    rejectSave(new Error('Connection failed'));
    await Promise.resolve();
    await Promise.resolve();
    expect(render().html).toContain('Connection failed');
    expect(render().html).toContain('value="Updated custody"');
    expect(render().saveButton?.props.disabled).toBe(false);
  });
});

describe('pipeline delete confirmation', () => {
  function page() {
    harness.cursor = 0;
    harness.effects = [];
    return nodes(Deals());
  }
  it('requires confirmation, locks duplicate deletes, and retains a server failure for retry', async () => {
    harness.request.mockImplementation((key: string) => Promise.resolve(key === 'deals' ? [deal] : []));
    page();
    harness.effects[0]();
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    page().find((node) => node.props.onCardClick)?.props.onCardClick?.(deal);
    page().find((node) => node.props.onDelete)?.props.onDelete?.(deal);
    expect(harness.remove).not.toHaveBeenCalled();
    let rejectDelete: (error: Error) => void = () => undefined;
    harness.remove.mockImplementation(() => new Promise<void>((_resolve, reject) => { rejectDelete = reject; }));
    const confirm = () => page().find((node) => node.props['data-testid'] === 'confirm-delete-btn');
    expect(confirm()).toBeDefined();
    const pending = confirm()?.props.onClick?.();
    expect(confirm()?.props.disabled).toBe(true);
    await confirm()?.props.onClick?.();
    expect(harness.remove).toHaveBeenCalledTimes(1);
    expect(harness.remove).toHaveBeenCalledWith('deals', ['d1']);
    rejectDelete(new Error('Deletion refused'));
    await pending;
    expect(confirm()?.props.disabled).toBe(false);
    expect(page().some((node) => node.props.children === 'Deletion refused')).toBe(true);
  });
});
