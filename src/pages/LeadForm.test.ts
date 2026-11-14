import { isValidElement, ReactNode } from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import { AutoFlowProcess } from '../types';
import { LeadForm } from './LeadForm';

const harness = vi.hoisted(() => {
  const states: unknown[] = [];
  return { states, cursor: 0, upsert: vi.fn(), navigate: vi.fn(), role: 'admin', autoflow: false };
});
vi.mock('react', async (original) => ({
  ...await original<typeof import('react')>(),
  useState: (initial: unknown) => {
    const index = harness.cursor++;
    if (!(index in harness.states)) harness.states[index] = typeof initial === 'function' ? initial() : initial;
    return [harness.states[index], (value: unknown) => { harness.states[index] = value; }];
  },
  useEffect: vi.fn(),
}));
vi.mock('react-router-dom', () => ({
  Link: () => null, useNavigate: () => harness.navigate,
  useSearchParams: () => [new URLSearchParams(harness.autoflow ? 'autoflow=flow-1' : '')],
}));
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ user: { id: 'admin', role: harness.role } }) }));
vi.mock('../components/Toast', () => ({ useToast: () => ({ push: vi.fn() }) }));
vi.mock('../data/store', () => ({
  getAllSync: (key: string) => key === 'autoFlowProcesses' && harness.autoflow ? [process] : [], newId: () => 'lead-1',
  upsert: (...args: unknown[]) => harness.upsert(...args),
}));
vi.mock('../utils/rules', () => ({
  applyAssignmentRule: () => null, findDuplicate: () => null,
  getStatusOptions: () => ['New'], matchesCondition: () => false,
}));
vi.mock('../utils/moduleFields', () => ({ getCustomFieldsAsModuleFields: () => [] }));
vi.mock('../components/CustomFieldsSection', () => ({
  CustomFieldsSection: () => null, validateCustomFields: () => ({}),
}));
interface Props {
  children?: ReactNode;
  id?: string;
  value?: string;
  role?: string;
  disabled?: boolean;
  onChange?: (event: { target: { value: string } }) => void;
  onSubmit?: (event: { preventDefault: () => void }) => void;
}
function nodes(node: ReactNode): import('react').ReactElement<Props>[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!isValidElement<Props>(node)) return [];
  return [node, ...nodes(node.props.children)];
}
function render() { harness.cursor = 0; return nodes(LeadForm()); }
function submit() { render().find((node) => node.type === 'form')?.props.onSubmit?.({ preventDefault: vi.fn() }); }
beforeEach(() => {
  harness.states = []; harness.role = 'admin'; harness.autoflow = false; harness.upsert.mockReset(); harness.navigate.mockReset();
});
it('keeps entered fields after a rejected create and enables retry', async () => {
  render().find((node) => node.props.id === 'lead-name-input')?.props.onChange?.({ target: { value: 'Tara Iyer' } });
  render().find((node) => node.props.id === 'lead-email-input')?.props.onChange?.({ target: { value: 'tara@example.com' } });
  harness.upsert.mockRejectedValueOnce(new Error('Network request failed'));
  submit();
  expect(render().find((node) => node.type === 'button' && node.props.children === 'Creating…')?.props.disabled).toBe(true);
  submit();
  expect(harness.upsert).toHaveBeenCalledTimes(1);
  await Promise.resolve();
  await Promise.resolve();
  const page = render();
  expect(page.find((node) => node.props.role === 'alert')?.props.children).toContain('Your entries are still here');
  expect(page.find((node) => node.props.id === 'lead-email-input')?.props.value).toBe('tara@example.com');
  expect(page.find((node) => node.type === 'button' && node.props.children === 'Create lead')?.props.disabled).toBe(false);
  harness.upsert.mockResolvedValueOnce({});
  submit();
  await Promise.resolve();
  await Promise.resolve();
  expect(harness.upsert).toHaveBeenCalledTimes(2);
  expect(harness.navigate).toHaveBeenCalledWith('/leads/lead-1');
});
it('keeps the direct new-lead route read-only for viewers', () => {
  harness.role = 'viewer';
  expect(render().some((node) => node.type === 'form')).toBe(false);
});

const process: AutoFlowProcess = {
  id: 'flow-1', name: 'Lead intake', productId: 'product-1', allowedRoles: ['admin'],
  targetModule: 'leads', status: 'published', lanes: [], milestones: [], createdAt: '', updatedAt: '',
  nodes: [
    { id: 'start', type: 'start', position: { x: 0, y: 0 }, laneId: '', milestoneId: '', data: { label: 'Start' } },
    { id: 'details', type: 'state', position: { x: 0, y: 0 }, laneId: '', milestoneId: '', data: { label: 'Details', fieldKeys: ['name', 'email'] } },
    { id: 'end', type: 'end', position: { x: 0, y: 0 }, laneId: '', milestoneId: '', data: { label: 'End' } },
  ],
  edges: [
    { id: 'start-details', source: 'start', target: 'details' },
    { id: 'details-end', source: 'details', target: 'end' },
  ],
};
it('retains AutoFlow entries after Finish fails and saves on retry', async () => {
  harness.autoflow = true;
  render().find((node) => node.props.id === 'lead-name-input')?.props.onChange?.({ target: { value: 'Tara Iyer' } });
  render().find((node) => node.props.id === 'lead-email-input')?.props.onChange?.({ target: { value: 'tara@example.com' } });
  expect(render().find((node) => node.type === 'button' && node.props.children === 'Finish')?.props.disabled).toBe(false);
  harness.upsert.mockRejectedValueOnce(new Error('Network request failed'));
  submit();
  expect(render().find((node) => node.type === 'button' && node.props.children === 'Saving…')?.props.disabled).toBe(true);
  submit();
  expect(harness.upsert).toHaveBeenCalledTimes(1);
  await Promise.resolve();
  await Promise.resolve();
  const page = render();
  expect(page.find((node) => node.props.role === 'alert')?.props.children).toBe('Lead was not created. Your entries are still here; press Finish to try again.');
  expect(page.find((node) => node.props.id === 'lead-name-input')?.props.value).toBe('Tara Iyer');
  expect(page.find((node) => node.props.id === 'lead-email-input')?.props.value).toBe('tara@example.com');
  expect(page.find((node) => node.type === 'button' && node.props.children === 'Finish')?.props.disabled).toBe(false);
  expect(harness.navigate).not.toHaveBeenCalled();
  harness.upsert.mockResolvedValueOnce({});
  submit();
  await Promise.resolve();
  await Promise.resolve();
  expect(harness.upsert).toHaveBeenCalledTimes(2);
  expect(harness.upsert).toHaveBeenLastCalledWith('leads', expect.objectContaining({ name: 'Tara Iyer', email: 'tara@example.com' }));
  expect(harness.navigate).toHaveBeenCalledWith('/leads/lead-1');
});
