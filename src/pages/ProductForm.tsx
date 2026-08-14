import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { getAllSync, newId, upsert } from '../data/store';
import { PageLayout, Product, PRODUCT_CATEGORIES } from '../types';
import { Select } from '../components/Select';
import { CustomFieldsSection, CustomFieldValues, validateCustomFields } from '../components/CustomFieldsSection';
import { useToast } from '../components/Toast';
import { useAuth } from '../auth/AuthContext';
import { getCustomFieldsAsModuleFields } from '../utils/moduleFields';
import { classNames } from '../utils';

export function ProductForm() {
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const [params] = useSearchParams();

  const layouts = getAllSync<PageLayout>('pageLayouts').filter((l) => l.module === 'products');
  const layout = layouts.find((l) => l.id === params.get('layout')) ?? layouts.find((l) => l.isDefault) ?? layouts[0];
  const allLayoutKeys = new Set(layout?.tabs.flatMap((t) => t.fieldKeys) ?? []);
  const [activeTabId, setActiveTabId] = useState(layout?.tabs[0]?.id ?? '');
  const activeTab = layout?.tabs.find((t) => t.id === activeTabId) ?? layout?.tabs[0];
  const isVisible = (key: string) => !layout || (activeTab?.fieldKeys.includes(key) ?? true);
  const customFieldIds = new Set(getCustomFieldsAsModuleFields('products').map((f) => f.key));
  const activeTabCustomIds = activeTab?.fieldKeys.filter((k) => customFieldIds.has(k)) ?? [];

  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [category, setCategory] = useState('Subscription');
  const [priceText, setPriceText] = useState('');
  const [description, setDescription] = useState('');
  const [active, setActive] = useState(true);
  const [errors, setErrors] = useState<{ name?: string; price?: string }>({});
  const [customFields, setCustomFields] = useState<CustomFieldValues>({});
  const [customErrors, setCustomErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const errs: typeof errors = {};
    const price = Number(priceText.replace(/[^0-9.]/g, ''));
    if (allLayoutKeys.has('name') && !name.trim()) errs.name = 'Product name is required.';
    if (allLayoutKeys.has('price') && (!priceText.trim() || !Number.isFinite(price) || price <= 0)) errs.price = 'Enter a valid price greater than 0.';
    setErrors(errs);
    const cErrs = validateCustomFields('products', 'form', customFields);
    setCustomErrors(cErrs);
    if (Object.keys(errs).length > 0 || Object.keys(cErrs).length > 0) return;

    const product: Product = {
      id: newId('product'),
      name: name.trim(),
      sku:
        sku.trim() ||
        `PRD-${name
          .trim()
          .split(/\s+/)
          .map((w) => w[0])
          .join('')
          .toUpperCase()}-${String(Date.now()).slice(-4)}`,
      category,
      price: Math.round(price),
      description: description.trim(),
      active,
      createdAt: new Date().toISOString(),
      customFields,
    };
    setBusy(true);
    await upsert('products', product);
    toast.push('success', `Product "${product.name}" created.`);
    navigate(`/products/${product.id}`);
  };

  return (
    <div data-testid="product-form-page">
      <nav className="breadcrumbs">
        <Link to="/products">Products</Link> <span>/</span> <span>New product</span>
      </nav>
      <div className="page-header">
        <h1>New product</h1>
      </div>
      {layout && <p className="muted" style={{ marginTop: -8 }}>Layout: {layout.name}</p>}

      <div className="card form-card">
        {layout && layout.tabs.length > 1 && (
          <div className="chip-filters" data-testid="product-form-layout-tabs" style={{ marginBottom: 16 }}>
            {layout.tabs.map((tab) => (
              <span
                key={tab.id}
                className={classNames('chip-filter', tab.id === activeTabId && 'active')}
                style={{ cursor: 'pointer' }}
                onClick={() => setActiveTabId(tab.id)}
              >
                {tab.label}
              </span>
            ))}
          </div>
        )}
        <div className="form-grid">
          {isVisible('name') && (
            <div className="field">
              <span className="field-label">Product name *</span>
              <input className="input" data-testid="product-name" value={name} onChange={(e) => setName(e.target.value)} />
              {errors.name && <span className="field-error">{errors.name}</span>}
            </div>
          )}
          {isVisible('sku') && (
            <div className="field">
              <span className="field-label">SKU</span>
              <input
                className="input"
                data-testid="product-sku"
                placeholder="Auto-generated if left empty"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
              />
            </div>
          )}
          {isVisible('category') && (
            <div className="field">
              <span className="field-label">Category</span>
              <Select
                value={category}
                options={PRODUCT_CATEGORIES.map((c) => ({ value: c, label: c }))}
                onChange={setCategory}
                testId="product-category"
              />
            </div>
          )}
          {isVisible('price') && (
            <div className="field">
              <span className="field-label">Price ($) *</span>
              <input
                className="input"
                data-testid="product-price"
                placeholder="e.g. 14900"
                value={priceText}
                onChange={(e) => setPriceText(e.target.value)}
              />
              {errors.price && <span className="field-error">{errors.price}</span>}
            </div>
          )}
          {isVisible('description') && (
            <div className="field field-span">
              <span className="field-label">Description</span>
              <textarea
                className="input"
                rows={3}
                data-testid="product-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          )}
          {isVisible('active') && (
            <label className="switch-row field-span">
              <label className="switch">
                <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
                <span className="switch-slider" />
              </label>
              Active (available for lead generation)
            </label>
          )}
          <CustomFieldsSection
            module="products"
            target="form"
            mode="edit"
            values={customFields}
            onChange={(k, v) => setCustomFields({ ...customFields, [k]: v })}
            errors={customErrors}
            includeIds={layout ? activeTabCustomIds : undefined}
          />
        </div>

        <div className="form-actions">
          <button className="btn" onClick={() => navigate('/products')}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={busy} onClick={submit}>
            {busy ? 'Creating…' : 'Create product'}
          </button>
        </div>
      </div>
    </div>
  );
}
