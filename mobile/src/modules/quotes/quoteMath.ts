import { QuoteLineItem } from '../../types';
import { round2 } from '../../utils';

export interface ComputedLine extends QuoteLineItem {
  lineTotal: number;
}

/**
 * Rounds each line's subtotal-minus-discount to the cent first, then sums the
 * already-rounded line totals — avoids compounding float error across rows (mirrors
 * src/components/QuoteLineItems.tsx's computeQuoteTotals exactly).
 */
export function computeQuoteTotals(lineItems: QuoteLineItem[]): { lines: ComputedLine[]; total: number } {
  const lines = lineItems.map((li) => {
    const subtotal = li.quantity * li.unitPrice;
    const discount = subtotal * (li.discountPct / 100);
    return { ...li, lineTotal: round2(subtotal - discount) };
  });
  const total = round2(lines.reduce((sum, l) => sum + l.lineTotal, 0));
  return { lines, total };
}
