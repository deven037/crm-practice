import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { newId, upsert, logAudit } from '../data/store';
import { Product, PRODUCT_CATEGORIES } from '../types';
import { Select } from '../components/Select';
import { useToast } from '../components/Toast';
import { useAuth } from '../auth/AuthContext';

export function ProductForm() {
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [category, setCategory] = useState('Subscription');
  const [priceText, setPriceText] = useState('');
  const [description, setDescription] = useState('');
  const [active, setActive] = useState(true);
  const [errors, setErrors] = useState<{ name?: string; price?: string }>({});
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const errs: typeof errors = {};
    const price = Number(priceText.replace(/[^0-9.]/g, ''));
    if (!name.trim()) errs.name = 'Product name is required.';
    if (!priceText.trim() || !Number.isFinite(price) || price <= 0) errs.price = 'Enter a valid price greater than 0.';
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

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
    };
    setBusy(true);
    await upsert('products', product);
    logAudit(user?.name ?? 'Unknown', 'product.create', `Created product ${product.name}`);
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

      <div className="card form-card">
        <div className="form-grid">
          <div className="field">
            <span className="field-label">Product name *</span>
            <input className="input" data-testid="product-name" value={name} onChange={(e) => setName(e.target.value)} />
            {errors.name && <span className="field-error">{errors.name}</span>}
          </div>
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
          <div className="field">
            <span className="field-label">Category</span>
            <Select
              value={category}
              options={PRODUCT_CATEGORIES.map((c) => ({ value: c, label: c }))}
              onChange={setCategory}
              testId="product-category"
            />
          </div>
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
          <label className="switch-row field-span">
            <label className="switch">
              <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
              <span className="switch-slider" />
            </label>
            Active (available for lead generation)
          </label>
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
