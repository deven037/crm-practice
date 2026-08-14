import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getAllSync } from '../data/store';
import { CUSTOM_FIELD_MODULES, CustomFieldModule, Product, Role } from '../types';
import { MultiSelect, SearchableSelect, Select } from '../components/Select';
import { useToast } from '../components/Toast';
import { blankDraft } from './AutoFlowDesigner';

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'rep', label: 'Sales Rep' },
  { value: 'viewer', label: 'Viewer' },
];

export function AutoFlowIntakeForm() {
  const navigate = useNavigate();
  const toast = useToast();
  const products = getAllSync<Product>('products');

  const [name, setName] = useState('');
  const [productId, setProductId] = useState('');
  const [allowedRoles, setAllowedRoles] = useState<string[]>(['admin', 'rep']);
  const [targetModule, setTargetModule] = useState<CustomFieldModule>('leads');
  const [errors, setErrors] = useState<{ name?: string; productId?: string; allowedRoles?: string }>({});

  const submit = () => {
    const errs: typeof errors = {};
    if (!name.trim()) errs.name = 'Process name is required.';
    if (!productId) errs.productId = 'Select a product.';
    if (allowedRoles.length === 0) errs.allowedRoles = 'Select at least one role.';
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    const draft = blankDraft(productId, targetModule, allowedRoles as Role[], name.trim());
    navigate('/setup/autoflow/draft', { state: { draft } });
  };

  return (
    <div data-testid="autoflow-intake-page">
      <nav className="breadcrumbs">
        <Link to="/setup">Setup</Link> <span>/</span> <Link to="/setup/autoflow">AutoFlow</Link> <span>/</span> <span>New process</span>
      </nav>
      <div className="page-header">
        <h1>New AutoFlow process</h1>
      </div>
      <p className="muted">
        Choose the product this process belongs to and who can use it — the product can't be changed once the
        process is created. You'll design the actual flow on the next screen.
      </p>

      <div className="card form-card">
        <div className="form-grid">
          <div className="field">
            <span className="field-label">Process name *</span>
            <input className="input" data-testid="autoflow-intake-name" value={name} onChange={(e) => setName(e.target.value)} />
            {errors.name && <span className="field-error">{errors.name}</span>}
          </div>
          <div className="field">
            <span className="field-label">Product *</span>
            <SearchableSelect
              value={productId}
              options={products.map((p) => ({ value: p.id, label: p.name }))}
              onChange={setProductId}
              placeholder="Search products…"
              testId="autoflow-intake-product"
            />
            {errors.productId && <span className="field-error">{errors.productId}</span>}
          </div>
          <div className="field">
            <span className="field-label">Target module</span>
            <Select
              value={targetModule}
              options={CUSTOM_FIELD_MODULES.map((m) => ({ value: m, label: m }))}
              onChange={(v) => setTargetModule(v as CustomFieldModule)}
              testId="autoflow-intake-module"
            />
          </div>
          <div className="field">
            <span className="field-label">Allowed roles *</span>
            <MultiSelect
              values={allowedRoles}
              options={ROLE_OPTIONS}
              onChange={setAllowedRoles}
              placeholder="Who can use this process…"
              testId="autoflow-intake-roles"
            />
            {errors.allowedRoles && <span className="field-error">{errors.allowedRoles}</span>}
          </div>
        </div>

        <div className="form-actions">
          <button className="btn" onClick={() => navigate('/setup/autoflow')}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={submit} data-testid="autoflow-intake-continue-btn">
            Continue to designer
          </button>
        </div>
      </div>
    </div>
  );
}
