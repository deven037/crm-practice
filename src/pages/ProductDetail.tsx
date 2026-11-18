import { CSSProperties, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Clock, FileText, MoreHorizontal, Pencil, Plus, Trash2, Undo2, XCircle } from 'lucide-react';
import { getAll, getAllSync, getById, removeMany, saveAll, upsert } from '../data/store';
import { Account, Lead, Product, Quote } from '../types';
import { Modal } from '../components/Modal';
import { CustomFieldsSection } from '../components/CustomFieldsSection';
import { Spinner } from '../components/Spinner';
import { useToast } from '../components/Toast';
import { useAuth } from '../auth/AuthContext';
import { useRecentlyViewed } from '../hooks/useRecentlyViewed';
import { classNames } from '../utils';
import { chargeOf, CHARGE_LABEL, familyHue, historyOf, productStats } from './products/productLogic';
import { PriceChart, ProductCard } from './products/productBits';
import { canWriteQuotes, dayText, money, moneyShort, plural, quoteSettingsNow, shortDay } from './quotes/quoteLogic';
import { QuoteStatusPill } from './quotes/quoteBits';

/**
 * A product's page: the card, the figures that matter when quoting it (price, quoted value, how often it wins,
 * average discount against the approval limit), the price history, the quotes and leads it is on, and its details.
 */
export function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const canWrite = canWriteQuotes(user?.role);
  const { recordView, removeViews } = useRecentlyViewed();
  const [product, setProduct] = useState<Product | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'failed'>('loading');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [menu, setMenu] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmName, setConfirmName] = useState('');
  const [busy, setBusy] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    setState('loading');
    (async () => {
      try {
        const [p, l, q] = await Promise.all([getById<Product>('products', id ?? '', true), getAll<Lead>('leads'), getAll<Quote>('quotes')]);
        if (!alive) return;
        if (!p) {
          setState('missing');
          removeViews([id ?? '']);
          return;
        }
        setProduct(p);
        setLeads(l.filter((lead) => lead.productId === p.id));
        setQuotes([...q]);
        setState('ready');
      } catch (error) {
        if (!alive) return;
        // A 404 means the product is gone; anything else is a connection problem.
        if ((error as { status?: number }).status === 404) { setState('missing'); removeViews([id ?? '']); } else setState('failed');
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (product) recordView({ module: 'products', id: product.id, label: product.name, link: `/products/${product.id}`, meta: { SKU: product.sku, Family: product.category } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id]);

  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(false); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', key); };
  }, [menu]);

  if (state === 'loading') return <Spinner label="Loading product…" />;
  if (state === 'failed') return <div className="banner banner-error" role="alert">This product couldn’t load. Check your connection and reload the page.</div>;
  if (state === 'missing' || !product) {
    return <div className="empty-cell">Product not found. <Link to="/products">Back to products</Link></div>;
  }

  const settings = quoteSettingsNow();
  const st = productStats(product, quotes);
  const history = historyOf(product);
  const previous = history.length > 1 ? history[history.length - 2] : null;
  const since = history[history.length - 1];
  const onQuotes = [...st.quotes].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

  const toggleSale = async () => {
    setMenu(false);
    setDeleting(false);
    const next = { ...product, active: !product.active };
    setBusy(true);
    try {
      const saved = await upsert<Product>('products', next);
      setProduct(saved);
      toast.push('success', saved.active ? `${saved.name} is on sale again.` : `${saved.name} retired. Quotes that have it keep it.`);
    } catch {
      toast.push('error', 'The change couldn’t be saved. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async () => {
    setBusy(true);
    try {
      // Leads that still point at the product lose the link; quotes keep their own copy of the line.
      const related = (await getAll<Lead>('leads')).filter((l) => l.productId === product.id);
      await saveAll('leads', related.map((l) => ({ ...l, productId: null })));
      await removeMany('products', [product.id]);
      removeViews([product.id]);
      toast.push('success', `Product "${product.name}" deleted.${related.length ? ` ${plural(related.length, 'lead')} unlinked.` : ''}`);
      navigate('/products');
    } catch {
      toast.push('error', 'The product couldn’t be deleted. Check your connection and try again.');
      setBusy(false);
    }
  };

  const dpct = Math.min(100, (st.avgDiscount / 30) * 100);
  const lim = Math.min(100, (settings.discountLimit / 30) * 100);

  return (
    <div className="pq3" data-testid="product-detail-page">
      <Link to="/products" className="contact-back"><ChevronLeft size={16} aria-hidden="true" /> All products</Link>
      <div className="pq-hero">
        <div className="pq-hero-card"><ProductCard product={product} big /></div>
        <div className="pq-hero-t">
          <span className="pq-lab">{product.category} · {product.sku}</span>
          <h1>{product.name}</h1>
          {product.description && <p>{product.description}</p>}
          <div className="pq-row">
            <span className="pq-pill" style={{ '--c': product.active ? '#1f9d63' : '#8a93a6' } as CSSProperties} data-testid="product-status"><i />{product.active ? 'On sale' : 'Retired'}</span>
            <span className="pq-tag"><Clock size={13} aria-hidden="true" />Added {dayText(product.createdAt)}</span>
            {product.layoutName && <span className="pq-tag">Layout: {product.layoutName}</span>}
          </div>
          <div className="pq-acts">
            {canWrite && (
              <button type="button" className="btn btn-primary contacts-primary" data-testid="quote-with-product" disabled={!product.active}
                title={product.active ? undefined : 'Retired products cannot go on new quotes'} onClick={() => navigate(`/quotes/new?product=${product.id}`)}>
                <FileText size={15} aria-hidden="true" /> Add to a new quote
              </button>
            )}
            {canWrite && <Link to={`/products/${product.id}/edit`} className="btn" data-testid="edit-product-btn"><Pencil size={14} aria-hidden="true" /> Edit</Link>}
            {canWrite && <Link to={`/leads/new?productId=${product.id}`} className="btn" data-testid="new-lead-for-product-btn"><Plus size={14} aria-hidden="true" /> New lead</Link>}
            {canWrite && (
              <div className="pq-menu" ref={menuRef}>
                <button type="button" className="btn pq-sq" aria-label="More actions" aria-haspopup="menu" aria-expanded={menu} data-testid="product-more" onClick={() => setMenu((m) => !m)}><MoreHorizontal size={17} aria-hidden="true" /></button>
                {menu && (
                  <div className="pq-pop right" role="menu">
                    <button type="button" role="menuitem" className="pq-opt" disabled={busy} data-testid="product-toggle-sale" onClick={toggleSale}>
                      {product.active ? <XCircle size={16} aria-hidden="true" /> : <Undo2 size={16} aria-hidden="true" />}{product.active ? 'Retire (stop selling)' : 'Put back on sale'}
                    </button>
                    <button type="button" role="menuitem" className="pq-opt danger" data-testid="delete-product-btn" onClick={() => { setMenu(false); setConfirmName(''); setDeleting(true); }}>
                      <Trash2 size={16} aria-hidden="true" /> Delete
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="pq-figs">
        <div className="pq-card-box pq-fig" style={{ animationDelay: '0ms' }}>
          <span className="pq-lab">List price</span>
          <b data-testid="product-price-figure">{money(product.price)}</b>
          <small>{CHARGE_LABEL[chargeOf(product)].toLowerCase()}{previous ? ` · was ${money(previous.price)} until ${shortDay(since.at).replace(/^(Today|Yesterday)$/, (w) => w.toLowerCase())}` : ''}</small>
        </div>
        <div className="pq-card-box pq-fig" style={{ animationDelay: '60ms' }}>
          <span className="pq-lab">Quoted</span>
          <b>{moneyShort(st.value)}</b>
          <small>on {plural(st.quotes.length, 'quote')}, {st.open} still open</small>
        </div>
        <div className="pq-card-box pq-fig ring" style={{ animationDelay: '120ms' }}>
          <svg className="pq-ringsvg" viewBox="0 0 36 36" aria-hidden="true">
            <circle cx="18" cy="18" r="15.9" stroke="var(--surface-3)" />
            {st.win !== null && <circle className="arc" cx="18" cy="18" r="15.9" pathLength={100} style={{ '--v': st.win } as CSSProperties} />}
          </svg>
          <div><span className="pq-lab">Won</span><b>{st.win === null ? '—' : `${st.win}%`}</b><small>of decided quotes</small></div>
        </div>
        <div className="pq-card-box pq-fig" style={{ animationDelay: '180ms' }}>
          <span className="pq-lab">Average discount</span>
          <b>{st.avgDiscount.toFixed(1)}%</b>
          <div className="pq-lim" aria-hidden="true"><i className={classNames(st.avgDiscount > settings.discountLimit && 'over')} style={{ width: `${dpct}%` }} /><em style={{ left: `${lim}%` }} /></div>
          <small>approval needed above {settings.discountLimit}%</small>
        </div>
      </div>

      <div className="pq-cols">
        <div className="pq-stack">
          <section className="pq-card-box pq-box">
            <div className="pq-box-h"><h2>Price history</h2><span className="pq-muted">last two years</span></div>
            <PriceChart history={history} />
            <p className="pq-note-s">Quotes keep the price they were made with, so changing the price never changes a quote already made.</p>
          </section>
          <section className="pq-card-box pq-box" data-testid="product-quotes">
            <div className="pq-box-h"><h2>On quotes</h2><span className="pq-muted">{onQuotes.length}</span></div>
            {onQuotes.length === 0 && <p className="pq-muted">Not on any quote yet.</p>}
            {onQuotes.map((q) => {
              const l = q.lineItems.find((x) => x.productId === product.id)!;
              return (
                <Link key={q.id} to={`/quotes/${q.id}`} className="pq-uq">
                  <b>{q.quoteNumber}</b>
                  <span className="pq-uq-a">{accountNameOf(q.accountId)}<small>{shortDay(q.createdAt)}</small></span>
                  <span className="r">{l.quantity} × {money(l.unitPrice)} <span className={classNames('pq-dz', l.discountPct > settings.discountLimit && 'over')}>{l.discountPct ? `−${l.discountPct}%` : 'list'}</span></span>
                  <QuoteStatusPill status={q.status} />
                </Link>
              );
            })}
          </section>
        </div>
        <div className="pq-stack">
          <section className="pq-card-box pq-box">
            <h2>Details</h2>
            <dl className="pq-kv">
              <div><dt>SKU</dt><dd><code>{product.sku}</code></dd></div>
              <div><dt>Family</dt><dd><span className="pq-pill" style={{ '--c': familyHue(product.category) } as CSSProperties}><i />{product.category}</span></dd></div>
              <div><dt>Charged</dt><dd>{chargeOf(product)}</dd></div>
              <div><dt>Price</dt><dd>{money(product.price)}</dd></div>
              <div><dt>Added</dt><dd>{dayText(product.createdAt)}</dd></div>
            </dl>
            <CustomFieldsSection module="products" target="detail" mode="view" values={product.customFields ?? {}} />
          </section>
          <section className="pq-card-box pq-box" data-testid="product-leads">
            <div className="pq-box-h"><h2>Leads for this product</h2><span className="pq-muted">{leads.length}</span></div>
            {leads.length === 0 && <p className="pq-muted">No leads yet.</p>}
            {leads.slice(0, 5).map((l) => (
              <Link key={l.id} to={`/leads/${l.id}`} className="pq-lead">
                <i className="tk-cav sm">{l.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}</i>
                <span><b>{l.name}</b><small>{l.company} · {l.status}</small></span>
              </Link>
            ))}
            {leads.length > 5 && <p className="pq-note-s">and {leads.length - 5} more</p>}
          </section>
        </div>
      </div>

      {deleting && (
        <Modal
          title={`Delete ${product.name}?`}
          onClose={() => setDeleting(false)}
          footer={
            <>
              <button className="btn" onClick={() => setDeleting(false)}>Cancel</button>
              {st.quotes.length > 0 && product.active && <button className="btn" disabled={busy} onClick={toggleSale}>Retire it instead</button>}
              <button className="btn btn-danger" data-testid="confirm-delete-btn" disabled={busy || ((leads.length > 0 || st.quotes.length > 0) && confirmName !== product.name)} onClick={doDelete}>
                Delete product
              </button>
            </>
          }
        >
          {leads.length === 0 && st.quotes.length === 0 ? (
            <p>This cannot be undone.</p>
          ) : (
            <>
              {st.quotes.length > 0 && (
                <p>It is on {plural(st.quotes.length, 'quote')}. Those quotes keep their own copy of the line, but the product is gone from reports. Retiring it is usually better: it stays on old quotes and cannot be added to new ones.</p>
              )}
              {leads.length > 0 && <p>{plural(leads.length, 'lead')} point at this product. Deleting it unlinks them; the leads are kept.</p>}
              <div className="field">
                <label className="field-label" htmlFor="product-delete-confirm">Type the product name to confirm</label>
                <input id="product-delete-confirm" className="input" data-testid="delete-confirm-input" placeholder={product.name} value={confirmName} onChange={(e) => setConfirmName(e.target.value)} />
              </div>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}

/** Account names come from the boot cache, so the list never waits for another request. */
const accountNameOf = (id: string) => getAllSync<Account>('accounts').find((a) => a.id === id)?.name ?? 'Unknown account';
