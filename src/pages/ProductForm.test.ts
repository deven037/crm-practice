import { isValidElement, ReactNode } from 'react';
import { beforeEach, expect, it, vi } from 'vitest';

const harness = vi.hoisted(() => ({
  states: [] as unknown[],
  cursor: 0,
  navigate: vi.fn(),
  push: vi.fn(),
  apiFetch: vi.fn(),
}));

vi.mock('react', async (original) => ({
  ...await original<typeof import('react')>(),
  useState: (initial: unknown) => {
    const index = harness.cursor++;
    if (!(index in harness.states)) harness.states[index] = initial;
    const states = harness.states;
    return [states[index], (value: unknown) => { states[index] = value; }];
  },
}));
vi.mock('react-router-dom', () => ({
  Link: () => null,
  useNavigate: () => harness.navigate,
  useSearchParams: () => [new URLSearchParams()],
}));
vi.mock('../data/store', () => ({
  getAllSync: () => [{
    module: 'products',
    isDefault: true,
    name: 'Default',
    tabs: [{ id: 'details', fieldKeys: ['name', 'price'] }],
  }],
}));
vi.mock('../data/apiFetch', () => ({ apiFetch: harness.apiFetch }));
vi.mock('../components/Select', () => ({ Select: () => null }));
vi.mock('../components/CustomFieldsSection', () => ({
  CustomFieldsSection: () => null,
  validateCustomFields: () => ({}),
}));
vi.mock('../components/Toast', () => ({ useToast: () => ({ push: harness.push }) }));
vi.mock('../utils/moduleFields', () => ({ getCustomFieldsAsModuleFields: () => [] }));

import { ProductForm } from './ProductForm';

interface FormNodeProps {
  children?: ReactNode;
  'data-testid'?: string;
  disabled?: boolean;
  value?: string;
  onClick?: () => Promise<void>;
  onChange?: (event: { target: { value: string } }) => void;
}

function formNodes(node: ReactNode): import('react').ReactElement<FormNodeProps>[] {
  if (Array.isArray(node)) return node.flatMap(formNodes);
  if (!isValidElement<FormNodeProps>(node)) return [];
  return [node, ...formNodes(node.props.children)];
}

function submitProduct(name: string) {
  harness.states = [];
  harness.cursor = 0;
  const navigate = vi.fn();
  harness.navigate = navigate;

  const fields = formNodes(ProductForm());
  fields.find((node) => node.props['data-testid'] === 'product-name')?.props.onChange?.({ target: { value: name } });
  fields.find((node) => node.props['data-testid'] === 'product-price')?.props.onChange?.({ target: { value: '2000' } });

  harness.cursor = 0;
  const submit = formNodes(ProductForm()).find((node) => node.props.children === 'Create product')?.props.onClick;
  if (!submit) throw new Error('Create product button is missing');
  return { navigate, pending: submit() };
}

beforeEach(() => {
  harness.apiFetch.mockReset();
  harness.push.mockReset();
});

it('opens the product returned to each of two concurrent Default-layout submissions', async () => {
  let finishFirst: (product: { id: string; name: string }) => void = () => {
    throw new Error('First request did not start');
  };
  harness.apiFetch
    .mockImplementationOnce(() => new Promise((resolve) => { finishFirst = resolve; }))
    .mockResolvedValueOnce({ id: 'product-server-2', name: 'Second product' });

  const first = submitProduct('First product');
  const second = submitProduct('Second product');
  await second.pending;
  expect(first.navigate).not.toHaveBeenCalled();
  finishFirst({ id: 'product-server-1', name: 'First product' });
  await first.pending;

  expect(harness.apiFetch).toHaveBeenCalledTimes(2);
  for (const [index, name] of ['First product', 'Second product'].entries()) {
    const [path, request] = harness.apiFetch.mock.calls[index];
    expect(path).toBe('/products');
    expect(request.method).toBe('POST');
    const body = JSON.parse(request.body);
    expect(body).toMatchObject({ name, price: 2000, layoutName: 'Default' });
    expect(body).not.toHaveProperty('id');
  }
  expect(first.navigate).toHaveBeenCalledWith('/products/product-server-1');
  expect(second.navigate).toHaveBeenCalledWith('/products/product-server-2');
  expect(harness.push).toHaveBeenCalledWith('success', 'Product "First product" created.');
  expect(harness.push).toHaveBeenCalledWith('success', 'Product "Second product" created.');
});

it('keeps the form usable after a rejected POST and opens the returned product on retry', async () => {
  harness.apiFetch
    .mockRejectedValueOnce(new Error('Save failed'))
    .mockResolvedValueOnce({ id: 'product-retry-server', name: 'Retry product' });

  const first = submitProduct('Retry product');
  harness.cursor = 0;
  expect(formNodes(ProductForm()).find((node) => node.props.children === 'Creating…')?.props.disabled).toBe(true);
  await first.pending;

  expect(harness.push).toHaveBeenCalledWith('error', 'Could not create the product. Try again.');
  expect(harness.push).not.toHaveBeenCalledWith('success', expect.any(String));
  expect(first.navigate).not.toHaveBeenCalled();

  harness.cursor = 0;
  const fields = formNodes(ProductForm());
  expect(fields.find((node) => node.props['data-testid'] === 'product-form-page')).toBeDefined();
  expect(fields.find((node) => node.props['data-testid'] === 'product-name')?.props.value).toBe('Retry product');
  expect(fields.find((node) => node.props['data-testid'] === 'product-price')?.props.value).toBe('2000');
  const retry = fields.find((node) => node.props.children === 'Create product');
  expect(retry?.props.disabled).toBe(false);
  if (!retry?.props.onClick) throw new Error('Create product button is missing');
  await retry.props.onClick();

  expect(harness.apiFetch).toHaveBeenCalledTimes(2);
  for (const [path, request] of harness.apiFetch.mock.calls) {
    expect(path).toBe('/products');
    expect(request.method).toBe('POST');
    expect(JSON.parse(request.body)).toMatchObject({ name: 'Retry product', price: 2000 });
  }
  expect(first.navigate).toHaveBeenCalledExactlyOnceWith('/products/product-retry-server');
  expect(harness.push).toHaveBeenCalledWith('success', 'Product "Retry product" created.');
});
