// Copy of server/src/quoteMath.ts (quote sums and rules); keep the two in step.
import type { ChargeType, Quote, QuoteLineItem, QuoteSettings } from '../../types';

export const DEFAULT_QUOTE_SETTINGS: QuoteSettings = {
  id: 'quote-settings',
  taxName: 'GST',
  taxPercent: 18,
  validityDays: 30,
  discountLimit: 15,
  approverId: null,
};

/** The saved settings with every gap filled from the defaults. */
export function settingsOf(rows: QuoteSettings[]): QuoteSettings {
  const saved = rows.find((r) => r.id === DEFAULT_QUOTE_SETTINGS.id) ?? rows[0];
  return { ...DEFAULT_QUOTE_SETTINGS, ...(saved ?? {}), id: DEFAULT_QUOTE_SETTINGS.id };
}

export const unitOf = (line: Pick<QuoteLineItem, 'unit'>): ChargeType => line.unit ?? 'One-time';
export const lineAmount = (line: Pick<QuoteLineItem, 'quantity' | 'unitPrice' | 'discountPct'>) =>
  line.quantity * line.unitPrice * (1 - (line.discountPct ?? 0) / 100);

export interface QuoteSums {
  /** Before discounts and tax. */
  gross: number;
  discount: number;
  tax: number;
  /** After discount, with tax, per charge type. */
  byUnit: Record<ChargeType, number>;
  /** What the customer pays in the first year: one-time + 12 x monthly + yearly, with tax. */
  firstYear: number;
}

export function quoteSums(lines: QuoteLineItem[], taxPercent: number): QuoteSums {
  const t = 1 + taxPercent / 100;
  const byUnit: Record<ChargeType, number> = { 'One-time': 0, Monthly: 0, Yearly: 0 };
  let gross = 0;
  let net = 0;
  for (const line of lines) {
    gross += line.quantity * line.unitPrice;
    const amount = lineAmount(line);
    net += amount;
    byUnit[unitOf(line)] += amount;
  }
  for (const k of Object.keys(byUnit) as ChargeType[]) byUnit[k] = byUnit[k] * t;
  return { gross, discount: gross - net, tax: net * (t - 1), byUnit, firstYear: byUnit['One-time'] + 12 * byUnit.Monthly + byUnit.Yearly };
}

/** Lines whose discount is above the bank's limit. */
export const overLimit = (lines: QuoteLineItem[], limit: number) => lines.filter((l) => (l.discountPct ?? 0) > limit);
export const needsApproval = (quote: Pick<Quote, 'lineItems'>, limit: number) => overLimit(quote.lineItems, limit).length > 0;
/** True when the quote can go to the customer as far as discounts go. */
export const approvalCleared = (quote: Pick<Quote, 'lineItems' | 'approval'>, limit: number) =>
  !needsApproval(quote, limit) || quote.approval === 'approved';

/** The same lines, quantities and discounts (what an approval was given for). */
export const sameTerms = (a: QuoteLineItem[], b: QuoteLineItem[]) =>
  JSON.stringify(a.map((l) => [l.productId, l.quantity, l.unitPrice, l.discountPct])) ===
  JSON.stringify(b.map((l) => [l.productId, l.quantity, l.unitPrice, l.discountPct]));
