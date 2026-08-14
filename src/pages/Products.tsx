import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAll } from '../data/store';
import { Product } from '../types';
import { SkeletonRows } from '../components/Spinner';
import { LayoutPickerPanel } from '../components/LayoutPickerPanel';
import { SlideOver } from '../components/SlideOver';
import { ToolBoxPanel } from '../components/ToolBoxPanel';
import { productThumbnailGradient } from '../utils/productThumbnail';
import { formatCurrency, formatDate } from '../utils';

export function Products() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState('');
  const [quickView, setQuickView] = useState<Product | null>(null);
  const [layoutPickerOpen, setLayoutPickerOpen] = useState(false);

  useEffect(() => {
    (async () => {
      setProducts(await getAll<Product>('products'));
      setLoading(false);
    })();
  }, []);

  // Recently created first
  const sorted = useMemo(
    () => [...products].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [products]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter(
      (p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)
    );
  }, [sorted, query]);

  return (
    <div data-testid="products-page">
      <div className="page-header">
        <h1>Products</h1>
        <div className="page-actions">
          <button className="btn btn-create" onClick={() => setLayoutPickerOpen(true)}>
            + New Product
          </button>
        </div>
      </div>

      <ToolBoxPanel
        module="products"
        links={[
          { label: 'Import Data', to: '/setup/import' },
          { label: 'Custom Fields', to: '/admin/objects/products' },
          { label: 'Customise Page Layout', to: '/setup/layouts/products' },
        ]}
      />

      <div className="toolbar">
        <input
          type="search"
          className="input search-input"
          placeholder="Search name, SKU, category…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <span className="muted">Sorted by most recently created</span>
      </div>

      {loading ? (
        <SkeletonRows rows={8} />
      ) : filtered.length === 0 ? (
        <div className="empty-cell">No products match “{query}”.</div>
      ) : (
        <div className="product-grid">
          {filtered.map((product) => (
            <div key={product.id} className="product-card" onClick={() => setQuickView(product)}>
              <div className="product-thumb" style={{ background: productThumbnailGradient(product.sku || product.id) }}>
                {product.sku}
              </div>
              <div className="product-card-body">
                <div className="product-card-sku">{product.category}</div>
                <div className="product-card-name">{product.name}</div>
                <div className="product-card-foot">
                  <span className="product-card-price">{formatCurrency(product.price)}</span>
                  <span className={`pill ${product.active ? 'status-qualified' : 'status-unqualified'}`}>
                    {product.active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {quickView && (
        <SlideOver
          title={quickView.name}
          testId="product-quick-view"
          onClose={() => setQuickView(null)}
          footer={
            <button className="btn btn-primary" onClick={() => navigate(`/products/${quickView.id}`)}>
              Open full page ↗
            </button>
          }
        >
          <div
            className="product-thumb"
            style={{ background: productThumbnailGradient(quickView.sku || quickView.id), borderRadius: 'var(--radius-lg)', marginBottom: 16 }}
          >
            {quickView.sku}
          </div>
          <dl className="detail-list">
            <dt>SKU</dt>
            <dd>
              <code>{quickView.sku}</code>
            </dd>
            <dt>Category</dt>
            <dd>{quickView.category}</dd>
            <dt>Price</dt>
            <dd>{formatCurrency(quickView.price)}</dd>
            <dt>Status</dt>
            <dd>{quickView.active ? 'Active' : 'Inactive'}</dd>
            <dt>Description</dt>
            <dd>{quickView.description || '—'}</dd>
            <dt>Created</dt>
            <dd>{formatDate(quickView.createdAt)}</dd>
          </dl>
        </SlideOver>
      )}

      {layoutPickerOpen && (
        <LayoutPickerPanel module="products" basePath="/products" onClose={() => setLayoutPickerOpen(false)} />
      )}
    </div>
  );
}
