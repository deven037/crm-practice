import { createElement, isValidElement, ReactElement, ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DealModal } from './Deals';
import { Deal } from '../types';

const harness = vi.hoisted(() => ({
  states: [] as unknown[], cursor: 0, validation: {} as Record<string, string>,
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
  useEffect: () => undefined,
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

interface Props {
  children?: ReactNode;
  footer?: ReactNode;
  onClick?: () => Promise<void>;
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
  return { html: renderToStaticMarkup(tree), elements, saveButton: elements.find((node) => node.props['data-testid'] === 'deal-save-btn') };
}
beforeEach(() => { harness.states = []; harness.cursor = 0; harness.validation = {}; save.mockReset(); });

describe('board edit dialog', () => {
  it('blocks a blank name and reports required custom fields without saving', async () => {
    render().elements.find((node) => node.props['data-testid'] === 'deal-name')?.props.onChange?.({ target: { value: '' } });
    harness.validation = { fleet: 'Fleet size is required.' };
    await render().saveButton?.props.onClick?.();
    const html = render().html;
    expect(html).toContain('Deal name is required.');
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('Fleet size is required.');
    expect(save).not.toHaveBeenCalled();
  });
  it('blocks saving with a missing required custom field even when the name is valid', async () => {
    harness.validation = { fleet: 'Fleet size is required.' };
    await render().saveButton?.props.onClick?.();
    expect(save).not.toHaveBeenCalled();
    expect(render().html).toContain('Fleet size is required.');
  });
  it('disables repeat saves in flight and retains the draft when the server rejects it', async () => {
    let rejectSave: (error: Error) => void = () => undefined;
    save.mockImplementation(() => new Promise<void>((_resolve, reject) => { rejectSave = reject; }));
    render().elements.find((node) => node.props['data-testid'] === 'deal-name')?.props.onChange?.({ target: { value: 'Updated custody' } });
    const pending = render().saveButton?.props.onClick?.();
    expect(render().saveButton?.props.disabled).toBe(true);
    await render().saveButton?.props.onClick?.();
    expect(save).toHaveBeenCalledTimes(1);
    rejectSave(new Error('Connection failed'));
    await pending;
    expect(render().html).toContain('Connection failed');
    expect(render().html).toContain('value="Updated custody"');
    expect(render().saveButton?.props.disabled).toBe(false);
  });
});
