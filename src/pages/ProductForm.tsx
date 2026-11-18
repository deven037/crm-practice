import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, ChevronLeft, Info } from 'lucide-react';
import { apiFetch } from '../data/apiFetch';
import { getAllSync, upsert } from '../data/store';
import { ChargeType, CustomFieldDef, PageLayout, Product, Quote } from '../types';
import { CustomFieldsSection, CustomFieldValues, validateCustomFields } from '../components/CustomFieldsSection';
import { useToast } from '../components/Toast';
import { SearchPicker } from './deals/dealBits';
import { CHARGES, CHARGE_LABEL, familyHue, productFamilies, skuSuggest } from './products/productLogic';
import { ProductCard } from './products/productBits';
import { money, plural, quoteSettingsNow } from './quotes/quoteLogic';

interface Draft {
  name: string;
  sku: string;
  category: string;
  priceText: string;
  unit: ChargeType;
  description: string;
  active: boolean;
}

/**
 * New product and Edit product, as a full page, with a live card beside the form and the line as a quote will
 * show it. The SKU is set once; changing the price later starts a new point in the price history.
 */
export function ProductForm({ existing }: { existing?: Product } = {}) {
  const navigate = useNavigate();
  const toast = useToast();
  const [params] = useSearchParams();
  const layouts = getAllSync<PageLayout>('pageLayouts').filter((l) => l.module === 'products');
  const layout = (existing ? layouts.find((l) => l.name === existing.layoutName) : undefined)
    ?? layouts.find((l) => l.id === params.get('layout')) ?? layouts.find((l) => l.isDefault) ?? layouts[0];
  const customIds = new Set(getAllSync<CustomFieldDef>('customFieldDefs').filter((d) => d.module === 'products').map((d) => d.id));
  const layoutCustomIds = layout?.tabs ? layout.tabs.flatMap((t) => t.fieldKeys).filter((k) => customIds.has(k)) : undefined;
  const families = productFamilies();
  const settings = quoteSettingsNow();

  // One state per field: form tests set several fields from one render. Add new states at the end.
  const [name, setName] = useState(existing?.name ?? '');
  const [skuText, setSku] = useState(existing?.sku ?? '');
  const [category, setCategory] = useState(existing?.category ?? '');
  const [priceText, setPriceText] = useState(existing ? String(existing.price) : '');
  const [unit, setUnit] = useState<ChargeType>(existing?.unit ?? 'One-time');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [active, setActive] = useState(existing?.active ?? true);
  const [errors, setErrors] = useState<{ name?: string; category?: string; sku?: string; price?: string }>({});
  const [customFields, setCustomFields] = useState<CustomFieldValues>(existing?.customFields ?? {});
  const [customErrors, setCustomErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const draft: Draft = { name, sku: skuText, category, priceText, unit, description, active };
  const set = (patch: Partial<Draft>) => {
    if (patch.name !== undefined) setName(patch.name);
    if (patch.sku !== undefined) setSku(patch.sku);
    if (patch.category !== undefined) setCategory(patch.category);
    if (patch.priceText !== undefined) setPriceText(patch.priceText);
    if (patch.unit !== undefined) setUnit(patch.unit);
    if (patch.description !== undefined) setDescription(patch.description);
    if (patch.active !== undefined) setActive(patch.active);
  };
  const price = Number(draft.priceText.replace(/[^0-9.]/g, ''));
  const suggestion = skuSuggest(draft.category, draft.name);
  const backTo = existing ? `/products/${existing.id}` : '/products';
  const priceChanged = !!existing && Number.isFinite(price) && price > 0 && price !== existing.price;
  const openUsing = existing
    ? getAllSync<Quote>('quotes').filter((q) => (q.status === 'Draft' || q.status === 'Sent') && q.lineItems.some((l) => l.productId === existing.id)).length
    : 0;

  const submit = async () => {
    const errs: typeof errors = {};
    if (!draft.name.trim()) errs.name = 'Give the product a name.';
    if (!draft.category) errs.category = 'Choose a family.';
    if (!draft.priceText.trim() || !Number.isFinite(price) || price <= 0) errs.price = 'Enter a valid price greater than 0.';
    const sku = (existing ? existing.sku : draft.sku.trim() || suggestion).toUpperCase();
    if (!existing && sku && getAllSync<Product>('products').some((p) => p.sku?.toUpperCase() === sku)) errs.sku = 'Another product already uses this SKU.';
    setErrors(errs);
    const cErrs = validateCustomFields('products', 'form', customFields, layoutCustomIds);
    setCustomErrors(cErrs);
    if (Object.keys(errs).length > 0 || Object.keys(cErrs).length > 0) return;

    const body = {
      name: draft.name.trim(),
      sku,
      category: draft.category,
      price: Math.round(price),
      unit: draft.unit,
      description: draft.description.trim(),
      active: draft.active,
      layoutName: existing ? existing.layoutName ?? null : layout?.name ?? null,
      customFields,
    };
    setBusy(true);
    try {
      if (existing) {
        const saved = await upsert<Product>('products', { ...existing, ...body });
        toast.push('success', priceChanged ? `Saved. New quotes start at ${money(saved.price)}.` : 'Changes saved.');
        navigate(`/products/${saved.id}`);
      } else {
        const saved = await apiFetch<Product>('/products', { method: 'POST', body: JSON.stringify(body) });
        toast.push('success', `Product "${saved.name}" created.`);
        navigate(`/products/${saved.id}`);
      }
    } catch {
      toast.push('error', existing ? 'The changes couldn’t be saved. Try again.' : 'Could not create the product. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const preview = { name: draft.name.trim(), sku: (existing ? existing.sku : draft.sku.trim().toUpperCase() || suggestion), price: Number.isFinite(price) ? price : 0, category: draft.category, active: draft.active, unit: draft.unit };

  return (
    <div className="deal3 pq3 pq-form-page" data-testid="product-form-page">
      <Link to={backTo} className="contact-back"><ChevronLeft size={16} aria-hidden="true" /> {existing ? existing.name : 'Products'}</Link>
      <div className="deal-fcols pq-fcols">
        <div className="card deal-formcard">
          <div className="acct-fhead">
            <h1>{existing ? `Edit ${existing.name}` : 'New product'}</h1>
            <p>{layout ? `Layout: ${layout.name}` : 'A product the bank sells, as quotes will show it.'}</p>
          </div>

          <div className="pq-sect">
            <h2>Basics</h2>
            <div className="form-grid">
              <div className="field field-span">
                <label className="field-label" htmlFor="product-name-input">Name *</label>
                <input id="product-name-input" className="input" data-testid="product-name" value={draft.name} placeholder="For example, Business Current Account Premium"
                  aria-invalid={errors.name ? true : undefined} onChange={(e) => set({ name: e.target.value })} />
                {errors.name && <span className="field-error">{errors.name}</span>}
              </div>
              <div className="field">
                <span className="field-label">Family *</span>
                <SearchPicker label="Family" find="Find a family" testId="product-family" value={draft.category} invalid={!!errors.category}
                  options={[...(draft.category && !families.includes(draft.category) ? [draft.category] : []), ...families].map((f) => ({ value: f, label: f, hue: familyHue(f) }))}
                  onPick={(v) => { set({ category: v }); setErrors({ ...errors, category: undefined }); }} />
                {errors.category && <span className="field-error">{errors.category}</span>}
              </div>
              <div className="field">
                <label className="field-label" htmlFor="product-sku-input">SKU</label>
                <input id="product-sku-input" className="input pq-upper" data-testid="product-sku" value={existing ? existing.sku : draft.sku} disabled={!!existing}
                  placeholder={suggestion || 'Made from the family and name'} aria-invalid={errors.sku ? true : undefined} onChange={(e) => set({ sku: e.target.value })} />
                {errors.sku && <span className="field-error">{errors.sku}</span>}
                {existing ? <span className="pq-hint">The SKU can’t change after the product is made.</span>
                  : suggestion && !draft.sku && <span className="pq-hint">Suggested <button type="button" className="pq-sug" onClick={() => set({ sku: suggestion })}>{suggestion}</button></span>}
              </div>
              <div className="field field-span">
                <label className="field-label" htmlFor="product-description-input">Description</label>
                <textarea id="product-description-input" className="input tk-ta" data-testid="product-description" value={draft.description} placeholder="What the customer gets"
                  onChange={(e) => set({ description: e.target.value })} />
              </div>
            </div>
          </div>

          <div className="pq-sect">
            <h2>Price</h2>
            <div className="form-grid">
              <div className="field">
                <label className="field-label" htmlFor="product-price-input">List price *</label>
                <input id="product-price-input" className="input pq-num" data-testid="product-price" inputMode="decimal" value={draft.priceText} placeholder="0"
                  aria-invalid={errors.price ? true : undefined} onChange={(e) => set({ priceText: e.target.value })} />
                {errors.price ? <span className="field-error">{errors.price}</span> : <span className="pq-hint">Before tax. Quotes add {settings.taxName} {settings.taxPercent}%.</span>}
              </div>
              <div className="field">
                <span className="field-label">Charged</span>
                <SearchPicker label="Charged" find="Find" testId="product-unit" value={draft.unit}
                  options={CHARGES.map((c) => ({ value: c, label: c, hint: CHARGE_LABEL[c] }))} onPick={(v) => set({ unit: v as ChargeType })} />
                <span className="pq-hint">A quote’s first-year value counts monthly prices 12 times.</span>
              </div>
            </div>
          </div>

          <div className="pq-sect">
            <h2>Selling</h2>
            <div className="pq-swrow">
              <div><b>On sale</b><small>Can be added to new quotes</small></div>
              <button type="button" className="pq-switch" role="switch" aria-checked={draft.active} aria-label="On sale" data-testid="product-active" onClick={() => set({ active: !draft.active })} />
            </div>
            <CustomFieldsSection module="products" target="form" mode="edit" values={customFields} onChange={(k, v) => setCustomFields({ ...customFields, [k]: v })} errors={customErrors} includeIds={layoutCustomIds} />
          </div>

          <div className="form-actions deal-savebar">
            <Link to={backTo} className="btn">Cancel</Link>
            <button type="button" className="btn btn-primary contacts-primary" disabled={busy} onClick={submit} data-testid="save-product-btn">
              {busy ? (existing ? 'Saving…' : 'Creating…') : existing ? 'Save changes' : 'Create product'}
            </button>
          </div>
        </div>

        <aside className="pq-prev" aria-label="Preview">
          <span className="pq-lab">Live preview</span>
          <ProductCard product={preview} big />
          <span className="pq-lab">On a quote it reads</span>
          <div className="pq-qline">
            <b>{preview.name || 'Product name'}</b><span className="r">{money(preview.price)}</span>
            <small>{preview.sku || 'SKU'} · {draft.unit}</small><small className="r">{CHARGE_LABEL[draft.unit]}</small>
          </div>
          {priceChanged && (
            <div className="pq-note info" data-testid="price-change-note"><Info size={16} aria-hidden="true" />
              <span>{openUsing ? `${plural(openUsing, 'open quote')} keep ${money(existing!.price)}. ` : ''}New quotes start at {money(price)}. The change goes into the price history.</span>
            </div>
          )}
          {!draft.active && <div className="pq-note"><AlertTriangle size={16} aria-hidden="true" /><span>Retired products stay on old quotes but can’t be added to new ones.</span></div>}
        </aside>
      </div>
    </div>
  );
}
