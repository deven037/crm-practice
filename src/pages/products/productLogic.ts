import { ChargeType, CHARGE_TYPES, PricePoint, Product, PRODUCT_CATEGORIES, Quote } from '../../types';
import { getStatusOptions } from '../../utils/rules';
import { lineAmount } from '../quotes/quoteMath';

/** The bank's product families (Setup → Status codes → Products — Family). */
export const productFamilies = (): string[] => getStatusOptions('products', 'category', PRODUCT_CATEGORIES);

const KNOWN_HUES: Record<string, string> = { Accounts: '#2f6fe0', Cards: '#7a4fd6', Payments: '#0f97a8', Lending: '#d9642b', Trade: '#1f9d63', Wealth: '#b8860b' };
const SPARE_HUES = ['#c2185b', '#3f51b5', '#00897b', '#8d6e63', '#5e35b1', '#ef6c00', '#546e7a', '#2e7d32'];

/** A steady colour per family: the standard ones keep theirs, a bank's own families get one from their name. */
export function familyHue(family: string | undefined): string {
  if (!family) return '#5b6b8a';
  if (KNOWN_HUES[family]) return KNOWN_HUES[family];
  let h = 0;
  for (const ch of family) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return SPARE_HUES[h % SPARE_HUES.length];
}

export type FamilyIcon = 'wallet' | 'card' | 'zap' | 'coins' | 'globe' | 'gem' | 'box';
const KNOWN_ICONS: Record<string, FamilyIcon> = { Accounts: 'wallet', Cards: 'card', Payments: 'zap', Lending: 'coins', Trade: 'globe', Wealth: 'gem' };
export const familyIcon = (family: string | undefined): FamilyIcon => (family && KNOWN_ICONS[family]) || 'box';

export const CHARGES: ChargeType[] = CHARGE_TYPES;
export const chargeOf = (p: Pick<Product, 'unit'>): ChargeType => p.unit ?? 'One-time';
/** Shown after a price: "/ month". */
export const CHARGE_SUFFIX: Record<ChargeType, string> = { 'One-time': '', Monthly: '/ month', Yearly: '/ year' };
/** Shown on a quote's totals: "Every month". */
export const CHARGE_LABEL: Record<ChargeType, string> = { 'One-time': 'Due once', Monthly: 'Every month', Yearly: 'Every year' };

/** Every price the product has had, oldest first; products from before 3.0 get their one price. */
export function historyOf(p: Product): PricePoint[] {
  return p.priceHistory?.length ? p.priceHistory : [{ price: p.price, at: p.createdAt, by: '' }];
}

/** A SKU from the family and the name's initials, for example Payments + "Merchant Settlement Plus" = PAY-MSP. */
export function skuSuggest(family: string, name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!family || !words.length) return '';
  const prefix = family.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || 'PRD';
  return `${prefix}-${words.map((w) => w[0]).join('').replace(/[^A-Za-z0-9]/g, '').slice(0, 4).toUpperCase()}`;
}

export interface ProductStats {
  quotes: Quote[];
  open: number;
  /** Share of decided quotes that were accepted, or null when none was decided. */
  win: number | null;
  avgDiscount: number;
  /** Quoted value after discount, before tax. */
  value: number;
  lines: number;
}

const DECIDED = ['Accepted', 'Rejected', 'Expired'];

export function productStats(p: Pick<Product, 'id'>, quotes: Quote[]): ProductStats {
  const on = quotes.filter((q) => q.lineItems.some((l) => l.productId === p.id));
  const decided = on.filter((q) => DECIDED.includes(q.status));
  const lines = on.flatMap((q) => q.lineItems.filter((l) => l.productId === p.id));
  return {
    quotes: on,
    open: on.filter((q) => !DECIDED.includes(q.status)).length,
    win: decided.length ? Math.round((decided.filter((q) => q.status === 'Accepted').length / decided.length) * 100) : null,
    avgDiscount: lines.length ? lines.reduce((s, l) => s + (l.discountPct ?? 0), 0) / lines.length : 0,
    value: lines.reduce((s, l) => s + lineAmount(l), 0),
    lines: lines.length,
  };
}

export function matchesProduct(p: Product, query: string): boolean {
  const q = query.trim().toLowerCase();
  return !q || `${p.name} ${p.sku} ${p.category}`.toLowerCase().includes(q);
}

/** Families in the bank's order, then any family a product still has that the list no longer holds. */
export function familiesIn(products: Product[]): string[] {
  const list = productFamilies();
  const extra = [...new Set(products.map((p) => p.category).filter((c) => c && !list.includes(c)))];
  return [...list, ...extra];
}
