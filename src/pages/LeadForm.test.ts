import { isValidElement, ReactNode } from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import { LeadForm } from './LeadForm';

const harness = vi.hoisted(() => {
  const states: unknown[] = [];
  return { states, cursor: 0, upsert: vi.fn(), navigate: vi.fn(), role: 'admin' };
});
vi.mock('react', async (original) => ({
  ...await original<typeof import('react')>(),
  useState: (initial: unknown) => {
    const index = harness.cursor++;
    if (!(index in harness.states)) harness.states[index] = initial;
    return [harness.states[index], (value: unknown) => { harness.states[index] = value; }];
  },
  useEffect: vi.fn(),
}));
vi.mock('react-router-dom', () => ({
  Link: () => null, useNavigate: () => harness.navigate,
  useSearchParams: () => [new URLSearchParams()],
}));
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ user: { id: 'admin', role: harness.role } }) }));
vi.mock('../components/Toast', () => ({ useToast: () => ({ push: vi.fn() }) }));
vi.mock('../data/store', () => ({
  getAllSync: () => [], newId: () => 'lead-1',
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
  harness.states = []; harness.role = 'admin'; harness.upsert.mockReset(); harness.navigate.mockReset();
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
