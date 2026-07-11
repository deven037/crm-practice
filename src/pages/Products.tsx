import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAll } from '../data/store';
import { Product } from '../types';
import { SkeletonRows } from '../components/Spinner';
import { formatCurrency, formatDate } from '../utils';

export function Products() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState('');

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
          <button className="btn btn-primary" onClick={() => navigate('/products/new')}>
            + New Product
          </button>
        </div>
      </div>

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
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>SKU</th>
                <th>Category</th>
                <th className="num">Price</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((product) => (
                <tr key={product.id} className="row-clickable" onClick={() => navigate(`/products/${product.id}`)}>
                  <td>{product.name}</td>
                  <td>
                    <code>{product.sku}</code>
                  </td>
                  <td>{product.category}</td>
                  <td className="num">{formatCurrency(product.price)}</td>
                  <td>
                    <span className={`pill ${product.active ? 'status-qualified' : 'status-unqualified'}`}>
                      {product.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>{formatDate(product.createdAt)}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty-cell">
                    No products match “{query}”.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
