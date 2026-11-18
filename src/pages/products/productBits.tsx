import { CSSProperties, PointerEvent, useRef } from 'react';
import { Coins, CreditCard, Gem, Globe, Package, Wallet, Zap } from 'lucide-react';
import { PricePoint, Product } from '../../types';
import { bankProfileSync } from '../../data/store';
import { classNames } from '../../utils';
import { money, moneyShort } from '../quotes/quoteLogic';
import { chargeOf, CHARGE_SUFFIX, familyHue, familyIcon, FamilyIcon } from './productLogic';

const ICONS: Record<FamilyIcon, typeof Wallet> = { wallet: Wallet, card: CreditCard, zap: Zap, coins: Coins, globe: Globe, gem: Gem, box: Package };

export function FamilyGlyph({ family, size = 17 }: { family?: string; size?: number }) {
  const Icon = ICONS[familyIcon(family)];
  return <Icon size={size} aria-hidden="true" />;
}

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * A product drawn as a bank card in its family's colour. It leans towards the pointer (not on touch screens,
 * and not when the device asks for less motion).
 */
export function ProductCard({ product, big = false }: { product: Pick<Product, 'name' | 'sku' | 'price' | 'category' | 'active' | 'unit'>; big?: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const bank = bankProfileSync()?.name ?? 'Harbor Bank';
  const move = (e: PointerEvent) => {
    const el = ref.current;
    if (!el || e.pointerType === 'touch' || reducedMotion()) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    el.classList.add('live');
    el.style.setProperty('--ry', `${((px - 0.5) * 16).toFixed(2)}deg`);
    el.style.setProperty('--rx', `${((0.5 - py) * 12).toFixed(2)}deg`);
    el.style.setProperty('--mx', `${Math.round(px * 100)}%`);
    el.style.setProperty('--my', `${Math.round(py * 100)}%`);
  };
  const leave = () => {
    const el = ref.current;
    if (!el) return;
    el.classList.remove('live');
    ['--rx', '--ry', '--mx', '--my'].forEach((v) => el.style.removeProperty(v));
  };
  return (
    <span
      ref={ref}
      className={classNames('pq-card', big && 'big', product.active === false && 'retired')}
      style={{ '--fc': familyHue(product.category) } as CSSProperties}
      onPointerMove={move}
      onPointerLeave={leave}
    >
      <span className="pq-card-top"><i className="pq-card-ic"><FamilyGlyph family={product.category} size={big ? 22 : 17} /></i><span className="pq-card-bank">{bank}</span></span>
      <span className="pq-card-nm">{product.name || 'Product name'}</span>
      <span className="pq-card-bot">
        <span className="pq-card-sku">{product.sku || 'SKU'}</span>
        <span className="pq-card-pr">{money(product.price || 0)}<small>{CHARGE_SUFFIX[chargeOf(product)]}</small></span>
      </span>
      {product.active === false && <span className="pq-card-ret">Retired</span>}
    </span>
  );
}

/** A small swatch of the product card, for lists and pickers. */
export function MiniCard({ product, size = 15 }: { product: Pick<Product, 'category' | 'active'>; size?: number }) {
  return (
    <span className={classNames('pq-mini', product.active === false && 'off')} style={{ '--fc': familyHue(product.category) } as CSSProperties} aria-hidden="true">
      <FamilyGlyph family={product.category} size={size} />
    </span>
  );
}

/** The price as a step line over the last two years, a point (with who set it) at every change. */
export function PriceChart({ history, now = Date.now() }: { history: PricePoint[]; now?: number }) {
  const W = 560;
  const H = 170;
  const l = 30;
  const r = 16;
  const t = 26;
  const b = 26;
  const from = now - 730 * 86_400_000;
  const pts = history.map((p) => ({ ...p, x: Math.max(Date.parse(p.at), from) }));
  const vs = pts.map((p) => p.price);
  const lo = Math.min(...vs) * 0.8;
  const hi = Math.max(...vs) * 1.12 || 1;
  const X = (ms: number) => l + ((ms - from) / (now - from)) * (W - l - r);
  const Y = (v: number) => t + (1 - (v - lo) / (hi - lo || 1)) * (H - t - b);
  let path = `M${X(pts[0].x)},${Y(pts[0].price)}`;
  pts.slice(1).forEach((p) => { path += ` H${X(p.x)} V${Y(p.price)}`; });
  path += ` H${X(now)}`;
  const area = `${path} V${H - b} H${X(pts[0].x)} Z`;
  const ticks = [730, 548, 365, 183, 0].map((d) => now - d * 86_400_000);
  return (
    <svg className="pq-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Price over the last two years">
      <defs>
        <linearGradient id="pq-price-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--bank-primary)" stopOpacity="0.22" />
          <stop offset="1" stopColor="var(--bank-primary)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.75].map((k) => <line key={k} className="pq-gl" x1={l} x2={W - r} y1={Y(lo + (hi - lo) * k)} y2={Y(lo + (hi - lo) * k)} />)}
      <path className="pq-area" d={area} />
      <path className="pq-line" d={path} pathLength={1} />
      {pts.map((p, i) => {
        const right = i === pts.length - 1 && X(p.x) > W - 90;
        return (
          <g key={i}>
            <circle className="pq-pt" cx={X(p.x)} cy={Y(p.price)} r={5}>
              <title>{`${money(p.price)} from ${new Date(p.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}${p.by ? ` · set by ${p.by}` : ''}`}</title>
            </circle>
            <text className="pq-pl" x={X(p.x) + (right ? -8 : 8)} y={Y(p.price) - 9} textAnchor={right ? 'end' : 'start'}>{moneyShort(p.price)}</text>
          </g>
        );
      })}
      {ticks.map((ms) => (
        <text key={ms} x={X(ms)} y={H - 6} textAnchor="middle">{new Date(ms).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}</text>
      ))}
    </svg>
  );
}
