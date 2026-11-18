import { CSSProperties, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutGrid, List, Package, Plus, Search } from 'lucide-react';
import { getAll, upsert } from '../data/store';
import { Product, Quote } from '../types';
import { ToolBoxMenu } from '../components/ToolBoxMenu';
import { LayoutPickerPanel } from '../components/LayoutPickerPanel';
import { useToast } from '../components/Toast';
import { useAuth } from '../auth/AuthContext';
import { classNames } from '../utils';
import { StatusPicker } from './leads/StatusPicker';
import { familiesIn, familyHue, matchesProduct, productStats, CHARGE_SUFFIX, chargeOf } from './products/productLogic';
import { MiniCard, ProductCard } from './products/productBits';
import { canWriteQuotes, money, moneyShort } from './quotes/quoteLogic';

export const PRODUCT_TOOLBOX_LINKS = [
  { label: 'Import data', to: '/setup/import' },
  { label: 'Custom fields', to: '/admin/objects/products' },
  { label: 'Customise page layout', to: '/setup/layouts/products' },
  { label: 'Product families', to: '/setup/status-codes' },
];

type SaleFilter = 'all' | 'on' | 'off';
const SALE_LABEL: Record<SaleFilter, string> = { all: 'On sale and retired', on: 'On sale', off: 'Retired' };

/**
 * The product catalogue: every product drawn as a card in its family's colour on a shelf per family,
 * or as a price list with an on-sale switch.
 */
export function Products() {
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const canWrite = canWriteQuotes(user?.role);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [query, setQuery] = useState('');
  const [families, setFamilies] = useState<string[]>([]);
  const [sale, setSale] = useState<SaleFilter>('all');
  const [view, setView] = useState<'cards' | 'list'>('cards');
  const [layoutPickerOpen, setLayoutPickerOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [p, q] = await Promise.all([getAll<Product>('products'), getAll<Quote>('quotes')]);
        if (!alive) return;
        setProducts([...p]);
        setQuotes([...q]);
      } catch {
        if (alive) setFailed(true);
      }
      if (alive) setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  const visible = useMemo(
    () => products
      .filter((p) => matchesProduct(p, query))
      .filter((p) => !families.length || families.includes(p.category))
      .filter((p) => sale === 'all' || (sale === 'on') === p.active)
      .sort((a, b) => a.name.localeCompare(b.name)),
    [products, query, families, sale],
  );
  const stats = useMemo(() => new Map(products.map((p) => [p.id, productStats(p, quotes)])), [products, quotes]);
  const allFamilies = familiesIn(products);
  const shelves = allFamilies.map((f) => ({ family: f, list: visible.filter((p) => p.category === f) })).filter((s) => s.list.length);
  const onSale = products.filter((p) => p.active).length;
  const familyCount = new Set(products.map((p) => p.category)).size;
  const filtered = query || families.length || sale !== 'all';

  const toggleSale = async (p: Product) => {
    const next = { ...p, active: !p.active };
    setProducts((list) => list.map((x) => (x.id === p.id ? next : x)));
    try {
      const saved = await upsert<Product>('products', next);
      setProducts((list) => list.map((x) => (x.id === p.id ? saved : x)));
      toast.push('success', saved.active ? `${saved.name} is on sale again.` : `${saved.name} retired. Quotes that have it keep it.`);
    } catch {
      setProducts((list) => list.map((x) => (x.id === p.id ? p : x)));
      toast.push('error', 'The change couldn’t be saved. Check your connection and try again.');
    }
  };

  let n = 0;
  return (
    <div className="pq3" data-testid="products-page">
      <div className="page-header">
        <div>
          <h1>Products</h1>
          <p className="pq-sub">{onSale} {onSale === 1 ? 'product' : 'products'} on sale in {familyCount} {familyCount === 1 ? 'family' : 'families'}. Prices here are what new quotes start from.</p>
        </div>
        <div className="page-actions">
          <ToolBoxMenu links={PRODUCT_TOOLBOX_LINKS} />
          {canWrite && (
            <button className="btn btn-primary contacts-primary" data-testid="new-product" onClick={() => setLayoutPickerOpen(true)}>
              <Plus size={16} aria-hidden="true" /> New product
            </button>
          )}
        </div>
      </div>

      <div className="pq-tools">
        <div className="contact-find pq-search">
          <Search size={17} aria-hidden="true" />
          <input type="search" className="input search-input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, SKU or family" aria-label="Search products" data-testid="product-search" />
        </div>
        <StatusPicker
          options={allFamilies}
          selected={families}
          multi
          label="Family"
          testId="product-family-filter"
          className={classNames('pq-fchip', families.length > 0 && 'set')}
          onPick={(f) => setFamilies((list) => (list.includes(f) ? list.filter((x) => x !== f) : [...list, f]))}
        >
          <Package size={14} aria-hidden="true" /> {families.length ? (families.length === 1 ? families[0] : `${families.length} families`) : 'Family'}
        </StatusPicker>
        <StatusPicker
          options={['On sale and retired', 'On sale', 'Retired']}
          selected={[SALE_LABEL[sale]]}
          label="On sale"
          testId="product-sale-filter"
          className={classNames('pq-fchip', sale !== 'all' && 'set')}
          onPick={(v) => setSale(v === 'On sale' ? 'on' : v === 'Retired' ? 'off' : 'all')}
        >
          {SALE_LABEL[sale]}
        </StatusPicker>
        {filtered && <button type="button" className="btn btn-ghost" onClick={() => { setQuery(''); setFamilies([]); setSale('all'); }}>Clear</button>}
        <span className="pq-spacer" />
        <div className="tk-seg" role="group" aria-label="View">
          <button type="button" aria-pressed={view === 'cards'} data-testid="view-cards" onClick={() => setView('cards')}><LayoutGrid size={14} aria-hidden="true" /> Cards</button>
          <button type="button" aria-pressed={view === 'list'} data-testid="view-price-list" onClick={() => setView('list')}><List size={14} aria-hidden="true" /> Price list</button>
        </div>
      </div>

      {failed && <div className="banner banner-error" role="alert">Products couldn’t load. Check your connection and reload the page.</div>}
      {loading && <div className="pq-card-box pq-empty">Loading products…</div>}
      {!loading && !failed && visible.length === 0 && (
        <div className="pq-card-box pq-empty"><b>{products.length ? 'No products match' : 'No products yet'}</b>{products.length ? 'Try another word, or clear the filters.' : canWrite ? 'Add the first one with New product.' : ''}</div>
      )}

      {!loading && visible.length > 0 && view === 'cards' && shelves.map((s) => (
        <section key={s.family} className="pq-fam" style={{ '--fc': familyHue(s.family) } as CSSProperties} data-testid={`product-family-${s.family}`}>
          <div className="pq-fam-h">
            <i className="pq-fdot" />
            <h2>{s.family}</h2>
            <span className="pq-muted">{s.list.length}</span>
            <span className="pq-fv"><b>{moneyShort(s.list.reduce((t, p) => t + (stats.get(p.id)?.value ?? 0), 0))}</b> quoted</span>
          </div>
          <div className="pq-shelf">
            {s.list.map((p) => {
              const st = stats.get(p.id)!;
              return (
                <button key={p.id} type="button" className="pq-slot" style={{ animationDelay: `${Math.min(n++, 16) * 35}ms`, '--fc': familyHue(p.category) } as CSSProperties}
                  data-testid={`product-card-${p.id}`} aria-label={`${p.name}, ${money(p.price)} ${CHARGE_SUFFIX[chargeOf(p)]}`} onClick={() => navigate(`/products/${p.id}`)}>
                  <ProductCard product={p} />
                  <span className="pq-slot-m">
                    <span>{st.open ? <><b>{st.open}</b> open {st.open === 1 ? 'quote' : 'quotes'}</> : p.active ? 'No open quotes' : 'Not sold any more'}</span>
                    <span>{st.win === null ? '' : <><b>{st.win}%</b> won</>}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ))}

      {!loading && visible.length > 0 && view === 'list' && (
        <div className="pq-card-box pq-plist" data-testid="product-price-list">
          <div className="pq-pl-row head"><span /><span>Product</span><span>Family</span><span className="r">Price</span><span className="r">Open quotes</span><span>Won</span><span className="r">Avg discount</span><span>On sale</span></div>
          {visible.map((p, i) => {
            const st = stats.get(p.id)!;
            return (
              <div key={p.id} className={classNames('pq-pl-row', !p.active && 'dim')} style={{ animationDelay: `${Math.min(i, 16) * 25}ms` }} role="link" tabIndex={0}
                data-testid={`product-row-${p.id}`}
                onClick={(e) => { if (!(e.target as HTMLElement).closest('button')) navigate(`/products/${p.id}`); }}
                onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget) navigate(`/products/${p.id}`); }}>
                <MiniCard product={p} />
                <span className="pq-nm2"><b>{p.name}</b><small>{p.sku}</small></span>
                <span><span className="pq-pill" style={{ '--c': familyHue(p.category) } as CSSProperties}><i />{p.category}</span></span>
                <span className="r"><b>{money(p.price)}</b> <small className="pq-muted">{CHARGE_SUFFIX[chargeOf(p)] || 'once'}</small></span>
                <span className="r">{st.open || '—'}</span>
                <span className="pq-wbar">{st.win === null ? '—' : <><span><i style={{ width: `${st.win}%` }} /></span>{st.win}%</>}</span>
                <span className="r">{st.lines ? `${st.avgDiscount.toFixed(1)}%` : '—'}</span>
                <span>
                  <button type="button" className="pq-switch" role="switch" aria-checked={p.active} aria-label={`${p.name} on sale`} disabled={!canWrite}
                    data-testid={`product-sale-${p.id}`} onClick={() => toggleSale(p)} />
                </span>
              </div>
            );
          })}
        </div>
      )}

      {layoutPickerOpen && <LayoutPickerPanel module="products" basePath="/products" onClose={() => setLayoutPickerOpen(false)} />}
    </div>
  );
}
