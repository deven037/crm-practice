import { CSSProperties, PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, ChevronLeft, Minus, Plus, Search, Send, ShieldCheck, X } from 'lucide-react';
import { apiFetch } from '../data/apiFetch';
import { getAllSync, newId, upsert } from '../data/store';
import { Account, Contact, Deal, Product, Quote, QuoteLineItem, User } from '../types';
import { useToast } from '../components/Toast';
import { useAuth } from '../auth/AuthContext';
import { classNames } from '../utils';
import { SearchPicker } from './deals/dealBits';
import { chargeOf, CHARGE_SUFFIX, familyHue, matchesProduct } from './products/productLogic';
import { MiniCard } from './products/productBits';
import { lineAmount, needsApproval, quoteSums } from './quotes/quoteMath';
import { dayText, money, previewNumber, quoteSettingsNow } from './quotes/quoteLogic';
import { QuotePaper } from './quotes/quoteBits';

const DAY = 86_400_000;
const VALIDITY = [15, 30, 45, 60];

function lineFor(p: Product, quantity = 1, discountPct = 0): QuoteLineItem {
  return { id: newId('qline'), productId: p.id, productName: p.name, quantity, unitPrice: p.price, discountPct, sku: p.sku, unit: chargeOf(p) };
}

/** The first-year value counts up to its new figure instead of jumping. */
function CountUp({ value }: { value: number }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = from.current;
    if (start === value || document.hidden || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      from.current = value;
      setShown(value);
      return;
    }
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / 450);
      const v = start + (value - start) * (1 - Math.pow(1 - k, 3));
      setShown(v);
      from.current = v;
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <b data-testid="builder-first-year">{money(shown)}</b>;
}

/**
 * New quote, Edit quote and Duplicate: products picked on the left (click, or drag onto the paper), quantities and
 * discounts per line, and the live paper on the right exactly as the customer will get it. A discount above the
 * bank's limit turns the line amber, and saving then asks the approver before the quote can go out.
 */
export function QuoteForm({ existing }: { existing?: Quote } = {}) {
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const [params] = useSearchParams();
  const settings = quoteSettingsNow();
  const accounts = getAllSync<Account>('accounts');
  const contacts = getAllSync<Contact>('contacts');
  const deals = getAllSync<Deal>('deals');
  const products = getAllSync<Product>('products');
  const users = getAllSync<User>('users');
  const allQuotes = getAllSync<Quote>('quotes');

  const start = (): { accountId: string; dealId: string | null; lines: QuoteLineItem[] } => {
    if (existing) return { accountId: existing.accountId, dealId: existing.dealId ?? null, lines: existing.lineItems.map((l) => ({ ...l })) };
    const from = allQuotes.find((q) => q.id === params.get('from'));
    if (from) {
      // A copy starts at today's prices; products that are gone keep their old line.
      const lines = from.lineItems.map((l) => { const p = products.find((x) => x.id === l.productId); return p ? lineFor(p, l.quantity, l.discountPct) : { ...l, id: newId('qline') }; });
      const openDeal = deals.find((d) => d.id === from.dealId && !d.stage.startsWith('Closed'));
      return { accountId: from.accountId, dealId: openDeal?.id ?? null, lines };
    }
    const seed = products.find((p) => p.id === params.get('product') && p.active);
    const deal = deals.find((d) => d.id === params.get('deal'));
    return { accountId: deal?.accountId ?? params.get('account') ?? '', dealId: deal?.id ?? null, lines: seed ? [lineFor(seed)] : [] };
  };
  const [initial] = useState(start);
  const [accountId, setAccountId] = useState(initial.accountId);
  const [dealId, setDealId] = useState<string | null>(initial.dealId);
  const [lines, setLines] = useState<QuoteLineItem[]>(initial.lines);
  const [validDays, setValidDays] = useState<number | null>(existing ? null : settings.validityDays);
  const [query, setQuery] = useState('');
  const [fresh, setFresh] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ account?: string; lines?: string }>({});
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const paperRef = useRef<HTMLDivElement>(null);
  const suppressClick = useRef(false);

  useEffect(() => {
    if (!fresh) return;
    const t = window.setTimeout(() => setFresh(null), 1700);
    return () => window.clearTimeout(t);
  }, [fresh]);

  const validUntil = validDays === null && existing ? existing.validUntil : new Date(Date.now() + (validDays ?? settings.validityDays) * DAY).toISOString();
  const account = accounts.find((a) => a.id === accountId);
  const openDeals = deals.filter((d) => d.accountId === accountId && !d.stage.startsWith('Closed'));
  const deal = deals.find((d) => d.id === dealId);
  const owner = users.find((u) => u.id === (existing?.ownerId ?? user?.id));
  const shownProducts = products.filter((p) => p.active && matchesProduct(p, query)).sort((a, b) => a.name.localeCompare(b.name));
  const retired = products.filter((p) => !p.active).length;
  const needs = needsApproval({ lineItems: lines }, settings.discountLimit);
  const sums = quoteSums(lines, settings.taxPercent);
  const sliderMax = Math.max(30, Math.ceil((settings.discountLimit + 15) / 5) * 5);
  const backTo = existing ? `/quotes/${existing.id}` : '/quotes';
  const sendable = !existing || existing.status === 'Draft';

  const add = (productId: string) => {
    const p = products.find((x) => x.id === productId);
    if (!p) return;
    const same = lines.find((l) => l.productId === p.id);
    if (same) {
      setLines(lines.map((l) => (l.id === same.id ? { ...l, quantity: l.quantity + 1 } : l)));
      setFresh(same.id);
    } else {
      const l = lineFor(p);
      setLines([...lines, l]);
      setFresh(l.id);
    }
    setErrors({ ...errors, lines: undefined });
  };
  const change = (id: string, patch: Partial<QuoteLineItem>) => setLines(lines.map((l) => (l.id === id ? { ...l, ...patch } : l)));

  // Drag a product chip onto the paper (mouse and pen; on touch screens a tap adds it).
  const startDrag = (e: ReactPointerEvent<HTMLButtonElement>, productId: string) => {
    if (e.button !== 0 || e.pointerType === 'touch') return;
    const chip = e.currentTarget;
    const x0 = e.clientX;
    const y0 = e.clientY;
    let fly: HTMLElement | null = null;
    let inside = false;
    const move = (ev: PointerEvent) => {
      if (!fly) {
        if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < 6) return;
        fly = chip.cloneNode(true) as HTMLElement;
        fly.classList.add('pq-fly');
        document.body.appendChild(fly);
        chip.classList.add('lifted');
        document.body.classList.add('tk-dragging');
      }
      fly.style.left = `${ev.clientX - 24}px`;
      fly.style.top = `${ev.clientY - 20}px`;
      const r = paperRef.current?.getBoundingClientRect();
      inside = !!r && ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom;
      setOver(inside);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      if (!fly) return;
      fly.remove();
      chip.classList.remove('lifted');
      document.body.classList.remove('tk-dragging');
      setOver(false);
      suppressClick.current = true;
      window.setTimeout(() => { suppressClick.current = false; }, 0);
      if (inside) add(productId);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const save = async (send: boolean) => {
    const errs: typeof errors = {};
    if (!accountId) errs.account = 'Choose who the quote is for.';
    if (!lines.length) errs.lines = 'Add at least one product.';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      const body: Quote = {
        ...(existing ?? { id: newId('quote'), quoteNumber: '', status: 'Draft' as const, createdAt: new Date().toISOString() }),
        accountId,
        dealId,
        lineItems: lines.map((l) => ({ ...l, quantity: Math.max(1, Math.round(l.quantity)) })),
        validUntil,
        ownerId: existing?.ownerId ?? user?.id ?? null,
      };
      let saved = await upsert<Quote>('quotes', body);
      if (send && saved.status === 'Draft') {
        if (needsApproval(saved, settings.discountLimit) && saved.approval !== 'approved') {
          if (saved.approval !== 'waiting') saved = await apiFetch<Quote>(`/quotes/${saved.id}/approval`, { method: 'POST', body: JSON.stringify({ decision: 'ask' }) });
          toast.push('success', `${saved.quoteNumber} saved. It goes out once the discount is approved.`);
        } else {
          const res = await apiFetch<{ quote: Quote }>(`/quotes/${saved.id}/transition`, { method: 'POST', body: JSON.stringify({ status: 'Sent' }) });
          saved = res.quote;
          toast.push('success', `${saved.quoteNumber} sent to ${contacts.find((c) => c.accountId === accountId)?.name ?? account?.name ?? 'the customer'}.`);
        }
      } else {
        toast.push('success', existing ? 'Changes saved.' : `${saved.quoteNumber} saved as a draft.`);
      }
      navigate(`/quotes/${saved.id}`);
    } catch (e) {
      toast.push('error', e instanceof Error && e.message ? e.message : 'The quote couldn’t be saved. Check your connection and try again.');
      setBusy(false);
    }
  };

  const previewQuote = { quoteNumber: existing?.quoteNumber ?? previewNumber(allQuotes), lineItems: lines, validUntil, createdAt: existing?.createdAt ?? new Date().toISOString(), status: 'Draft' as const, decidedAt: null };

  return (
    <div className="deal3 pq3 pq-builder" data-testid="quote-form-page">
      <Link to={backTo} className="contact-back"><ChevronLeft size={16} aria-hidden="true" /> {existing ? existing.quoteNumber : 'Quotes'}</Link>
      <div className="pq-bh">
        <h1>{existing ? `Edit ${existing.quoteNumber}` : 'New quote'}</h1>
        <p>Pick products on the left. The quote on the right is exactly what the customer will get.</p>
      </div>
      <div className="pq-studio">
        <div className="pq-stack">
          <section className="pq-card-box pq-box">
            <h2>Customer</h2>
            <div className="form-grid">
              <div className="field">
                <span className="field-label">Account *</span>
                <SearchPicker label="Account" find="Find an account" testId="quote-account" value={accountId} invalid={!!errors.account}
                  options={[...accounts].sort((a, b) => a.name.localeCompare(b.name)).map((a) => ({ value: a.id, label: a.name, hint: a.industry }))}
                  onPick={(v) => {
                    setAccountId(v);
                    const open = deals.filter((d) => d.accountId === v && !d.stage.startsWith('Closed'));
                    setDealId(open.length === 1 ? open[0].id : null);
                    setErrors({ ...errors, account: undefined });
                  }} />
                {errors.account && <span className="field-error">{errors.account}</span>}
              </div>
              <div className="field">
                <span className="field-label">Deal</span>
                <SearchPicker label="Deal" find="Find a deal" testId="quote-deal" value={dealId ?? ''}
                  options={[{ value: '', label: accountId ? (openDeals.length ? 'No deal' : 'No open deals') : 'Choose the account first' }, ...openDeals.map((d) => ({ value: d.id, label: d.name, hint: d.stage }))]}
                  onPick={(v) => setDealId(v || null)} />
              </div>
              <div className="field field-span">
                <span className="field-label">Valid for</span>
                <div className="pq-vchips" role="group" aria-label="Valid for">
                  {VALIDITY.map((d) => <button key={d} type="button" aria-pressed={validDays === d} onClick={() => setValidDays(d)}>{d} days</button>)}
                  <span className="pq-muted pq-small">until {dayText(validUntil)}</span>
                </div>
              </div>
            </div>
          </section>

          <section className="pq-card-box pq-box">
            <div className="pq-box-h"><h2>Products</h2>{retired > 0 && <span className="pq-muted pq-small">{retired} retired {retired === 1 ? 'product' : 'products'} hidden</span>}</div>
            <div className="contact-find pq-search wide">
              <Search size={17} aria-hidden="true" />
              <input type="search" className="input search-input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search products" aria-label="Search products" data-testid="builder-product-search" />
            </div>
            <div className="pq-chips">
              {shownProducts.map((p) => (
                <button key={p.id} type="button" className="pq-pchip" title="Click, or drag onto the quote" data-testid={`add-product-${p.id}`}
                  onPointerDown={(e) => startDrag(e, p.id)} onClick={() => { if (!suppressClick.current) add(p.id); }}>
                  <MiniCard product={p} size={12} />
                  <span><b>{p.name}</b><small>{money(p.price)} {CHARGE_SUFFIX[chargeOf(p)] || 'one-time'}</small></span>
                  <Plus size={16} aria-hidden="true" />
                </button>
              ))}
              {shownProducts.length === 0 && <p className="pq-muted">No product matches.</p>}
            </div>
          </section>

          <section className={classNames('pq-card-box pq-box', errors.lines && 'bad')} data-testid="builder-lines">
            <div className="pq-box-h"><h2>Lines</h2><span className="pq-muted">{lines.length}</span></div>
            {lines.length === 0 && <p className="pq-muted">No lines yet. Click a product above or drag it onto the quote.</p>}
            {lines.map((l) => {
              const p = products.find((x) => x.id === l.productId);
              const isOver = l.discountPct > settings.discountLimit;
              return (
                <div key={l.id} className={classNames('pq-ln', isOver && 'over')} style={{ '--fc': familyHue(p?.category) } as CSSProperties} data-testid={`line-${l.productId}`}>
                  <span className="sw" />
                  <span className="lm"><b>{l.productName}</b><small>{money(l.unitPrice)} {CHARGE_SUFFIX[l.unit ?? 'One-time'] || 'one-time'}</small></span>
                  <span className="pq-step">
                    <button type="button" aria-label={`Fewer ${l.productName}`} onClick={() => change(l.id, { quantity: Math.max(1, l.quantity - 1) })}><Minus size={14} /></button>
                    <input value={l.quantity} inputMode="numeric" aria-label={`Quantity of ${l.productName}`}
                      onChange={(e) => { const v = parseInt(e.target.value, 10); if (v > 0) change(l.id, { quantity: v }); }} />
                    <button type="button" aria-label={`More ${l.productName}`} onClick={() => change(l.id, { quantity: l.quantity + 1 })}><Plus size={14} /></button>
                  </span>
                  <button type="button" className="rm" aria-label={`Remove ${l.productName}`} onClick={() => setLines(lines.filter((x) => x.id !== l.id))}><X size={16} /></button>
                  <span className="pq-dsl">
                    <span>Discount <b>{l.discountPct}%</b></span>
                    <span className="pq-dtrack" style={{ '--lim': `${(settings.discountLimit / sliderMax) * 100}%` } as CSSProperties}>
                      <input type="range" min={0} max={sliderMax} step={1} value={l.discountPct} aria-label={`Discount on ${l.productName}`}
                        onChange={(e) => change(l.id, { discountPct: Number(e.target.value) })} />
                    </span>
                    {isOver && <span className="pq-dnote"><ShieldCheck size={13} aria-hidden="true" />Over {settings.discountLimit}%: needs approval before it is sent</span>}
                  </span>
                  <span className="la">{money(lineAmount(l))}</span>
                </div>
              );
            })}
            {errors.lines && <p className="field-error"><AlertTriangle size={14} aria-hidden="true" /> {errors.lines}</p>}
          </section>
        </div>

        <div ref={paperRef} className={classNames('pq-paperbox', over && 'over')}>
          <QuotePaper quote={previewQuote} account={account} contactName={contacts.find((c) => c.accountId === accountId)?.name} deal={deal} owner={owner} settings={settings} live freshLine={fresh} />
        </div>
      </div>

      <div className="pq-dock">
        <div className="pq-tot2"><small>First-year value incl. {settings.taxName}</small><CountUp value={sums.firstYear} /></div>
        <div className="pq-acts">
          <Link to={backTo} className="btn btn-ghost">Cancel</Link>
          <button type="button" className="btn" disabled={busy} data-testid="save-quote-btn" onClick={() => save(false)}>{existing ? 'Save changes' : 'Save draft'}</button>
          {sendable && (
            <button type="button" className="btn btn-primary contacts-primary" disabled={busy} data-testid="save-and-send" onClick={() => save(true)}>
              {needs ? <><ShieldCheck size={15} aria-hidden="true" /> Save and ask for approval</> : <><Send size={15} aria-hidden="true" /> Save and send</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
