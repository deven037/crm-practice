import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Pencil, Trash2 } from 'lucide-react';
import { getAll, getAllSync, getById, removeMany, saveAll, upsert } from '../data/store';
import { Lead, Product, PRODUCT_CATEGORIES, Quote } from '../types';
import { Modal } from '../components/Modal';
import { Select } from '../components/Select';
import { CustomFieldsSection } from '../components/CustomFieldsSection';
import { RecordShell } from '../components/RecordShell';
import { Spinner } from '../components/Spinner';
import { useToast } from '../components/Toast';
import { useAuth } from '../auth/AuthContext';
import { useRecentlyViewed } from '../hooks/useRecentlyViewed';
import { formatCurrency, formatDate } from '../utils';

export function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [product, setProduct] = useState<Product | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [affectedQuotes, setAffectedQuotes] = useState<Quote[]>([]);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmName, setConfirmName] = useState('');
  const { user } = useAuth();
  const { recordView } = useRecentlyViewed();

  useEffect(() => {
    (async () => {
      const [p, l, q] = await Promise.all([
        getById<Product>('products', id ?? ''),
        getAll<Lead>('leads'),
        getAll<Quote>('quotes'),
      ]);
      if (!p) {
        setNotFound(true);
        return;
      }
      setProduct(p);
      setLeads(l.filter((lead) => lead.productId === p.id));
      setAffectedQuotes(q.filter((quote) => quote.lineItems.some((li) => li.productId === p.id)));
    })();
  }, [id]);

  useEffect(() => {
    if (product) recordView({ module: 'products', id: product.id, label: product.name, link: `/products/${product.id}`, meta: { SKU: product.sku, Category: product.category } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id]);

  if (notFound) {
    return (
      <div className="empty-cell">
        Product not found. <Link to="/products">Back to products</Link>
      </div>
    );
  }
  if (!product) return <Spinner label="Loading product…" />;

  const save = async () => {
    if (!draft) return;
    if (!draft.name.trim()) {
      toast.push('error', 'Product name is required.');
      return;
    }
    await upsert('products', draft);
    setProduct(draft);
    setEditing(false);
    toast.push('success', 'Product updated.');
  };

  const doDelete = async () => {
    if (leads.length > 0) {
      // Unlink the product from every lead that references it — leads survive.
      const allLeads = getAllSync<Lead>('leads').map((l) =>
        l.productId === product.id ? { ...l, productId: null } : l
      );
      await saveAll('leads', allLeads);
    }
    // Quotes are NOT mutated: each line item already snapshots productName/unitPrice,
    // so QuoteLineItemsView falls back to "{productName} (deleted product)" once the
    // product no longer resolves — no write needed to keep the quote's history readable.
    await removeMany('products', [product.id]);
    toast.push('success', `Product "${product.name}" deleted.${leads.length > 0 ? ` ${leads.length} lead(s) unlinked.` : ''}`);
    navigate('/products');
  };

  const hasDependents = leads.length > 0 || affectedQuotes.length > 0;

  const detailsTab = !editing ? (
    <dl className="detail-list">
      <dt>SKU</dt>
      <dd>
        <code>{product.sku}</code>
      </dd>
      <dt>Category</dt>
      <dd>{product.category}</dd>
      <dt>Price</dt>
      <dd>{formatCurrency(product.price)}</dd>
      <dt>Description</dt>
      <dd>{product.description || '—'}</dd>
      <dt>Created</dt>
      <dd>{formatDate(product.createdAt)}</dd>
      <CustomFieldsSection module="products" target="detail" mode="view" values={product.customFields ?? {}} />
    </dl>
  ) : (
    draft && (
      <div className="form-grid">
        <div className="field">
          <span className="field-label">Product name *</span>
          <input className="input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        </div>
        <div className="field">
          <span className="field-label">Category</span>
          <Select
            value={draft.category}
            options={PRODUCT_CATEGORIES.map((c) => ({ value: c, label: c }))}
            onChange={(v) => setDraft({ ...draft, category: v })}
          />
        </div>
        <div className="field">
          <span className="field-label">Price ($)</span>
          <input
            className="input"
            type="number"
            value={draft.price}
            onChange={(e) => setDraft({ ...draft, price: Number(e.target.value) })}
          />
        </div>
        <label className="switch-row">
          <label className="switch">
            <input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} />
            <span className="switch-slider" />
          </label>
          Active
        </label>
        <div className="field field-span">
          <span className="field-label">Description</span>
          <textarea
            className="input"
            rows={3}
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          />
        </div>
        <CustomFieldsSection
          module="products"
          target="detail"
          mode="edit"
          values={draft.customFields ?? {}}
          onChange={(k, v) => setDraft({ ...draft, customFields: { ...draft.customFields, [k]: v } })}
        />
      </div>
    )
  );

  const leadsTab = (
    <div className="card">
      <div className="page-header" style={{ border: 'none', marginBottom: 12, paddingBottom: 0 }}>
        <h3>Leads generated ({leads.length})</h3>
        <button
          className="btn btn-small"
          data-testid="new-lead-for-product-btn"
          onClick={() => navigate(`/leads/new?productId=${product.id}`)}
        >
          + New lead for this product
        </button>
      </div>
      {leads.length === 0 ? (
        <p className="muted">No leads yet for this product.</p>
      ) : (
        <ul className="related-list">
          {leads.map((lead) => (
            <li key={lead.id}>
              <Link to={`/leads/${lead.id}`}>{lead.name}</Link>{' '}
              <span className="muted">
                — {lead.company} · <span className={`pill status-${lead.status.toLowerCase()}`}>{lead.status}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <>
      <RecordShell
        testId="product-detail-page"
        breadcrumbs={[{ label: 'Products', to: '/products' }, { label: product.name }]}
        title={product.name}
        keyInfo={[
          { label: 'Status', value: <span className={`pill ${product.active ? 'status-qualified' : 'status-unqualified'}`} data-testid="product-status">{product.active ? 'Active' : 'Inactive'}</span> },
          { label: 'SKU', value: <code>{product.sku}</code> },
          { label: 'Category', value: product.category },
          { label: 'Price', value: formatCurrency(product.price) },
          { label: 'Layout', value: product.layoutName || '—' },
          { label: 'Created', value: formatDate(product.createdAt) },
        ]}
        tabs={[
          { id: 'details', label: 'Details', content: <div className="card">{detailsTab}</div> },
          { id: 'leads', label: `Leads (${leads.length})`, content: leadsTab },
        ]}
        actions={
          !editing ? (
            <>
              <button
                className="btn"
                data-testid="edit-product-btn"
                onClick={() => {
                  setDraft({ ...product });
                  setEditing(true);
                }}
              >
                <Pencil size={14} /> Edit
              </button>
              <button
                className="btn btn-danger"
                data-testid="delete-product-btn"
                onClick={() => {
                  setConfirmName('');
                  setDeleting(true);
                }}
              >
                <Trash2 size={14} /> Delete
              </button>
            </>
          ) : (
            <>
              <button className="btn" onClick={() => setEditing(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" data-testid="save-product-btn" onClick={save}>
                Save
              </button>
            </>
          )
        }
      />

      {deleting && (
        <Modal
          title={`Delete product — ${product.name}`}
          onClose={() => setDeleting(false)}
          footer={
            <>
              <button className="btn" onClick={() => setDeleting(false)}>
                Cancel
              </button>
              <button
                className="btn btn-danger"
                data-testid="confirm-delete-btn"
                disabled={hasDependents && confirmName !== product.name}
                onClick={doDelete}
              >
                Delete product
              </button>
            </>
          }
        >
          {!hasDependents ? (
            <p>Delete “{product.name}”? This cannot be undone.</p>
          ) : (
            <>
              <div className="banner banner-error" role="alert">
                {leads.length > 0 && (
                  <p>
                    {leads.length} lead(s) reference this product. Deleting it will <strong>unlink</strong> the product
                    from those leads — the leads themselves are kept.
                  </p>
                )}
                {affectedQuotes.length > 0 && (
                  <p>
                    {affectedQuotes.length} quote(s) reference this product in a line item — those quotes will keep
                    showing the product's name as a historical record, marked "(deleted product)".
                  </p>
                )}
              </div>
              <div className="field">
                <span className="field-label">Type the product name to confirm</span>
                <input
                  className="input"
                  data-testid="delete-confirm-input"
                  placeholder={product.name}
                  value={confirmName}
                  onChange={(e) => setConfirmName(e.target.value)}
                />
              </div>
            </>
          )}
        </Modal>
      )}
    </>
  );
}
