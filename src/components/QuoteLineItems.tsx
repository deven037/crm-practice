import { Link } from 'react-router-dom';
import { getAllSync, newId } from '../data/store';
import { Product, QuoteLineItem, QuoteStatus } from '../types';
import { SearchableSelect } from './Select';
import { formatCurrency, round2 } from '../utils';

export const QUOTE_STATUS_PILL: Record<QuoteStatus, string> = {
  Draft: 'status-new',
  Sent: 'status-contacted',
  Accepted: 'status-converted',
  Rejected: 'status-unqualified',
  Expired: 'pill-overdue',
};

export interface ComputedLine extends QuoteLineItem {
  lineTotal: number;
}

/**
 * Rounds each line's subtotal-minus-discount to the cent first, then sums the
 * already-rounded line totals — avoids compounding float error across rows and
 * gives testers an independently-verifiable per-row formula.
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

export function QuoteLineItemsEditor({
  lineItems,
  onChange,
  products,
}: {
  lineItems: QuoteLineItem[];
  onChange: (items: QuoteLineItem[]) => void;
  products: Product[];
}) {
  const { lines, total } = computeQuoteTotals(lineItems);

  const updateLine = (id: string, patch: Partial<QuoteLineItem>) => {
    onChange(lineItems.map((li) => (li.id === id ? { ...li, ...patch } : li)));
  };

  const addLine = () => {
    onChange([...lineItems, { id: newId('qline'), productId: '', productName: '', quantity: 1, unitPrice: 0, discountPct: 0 }]);
  };

  const removeLine = (id: string) => onChange(lineItems.filter((li) => li.id !== id));

  const pickProduct = (id: string, productId: string) => {
    const product = products.find((p) => p.id === productId);
    updateLine(id, { productId, productName: product?.name ?? '', unitPrice: product?.price ?? 0 });
  };

  return (
    <div className="line-item-table">
      <table className="table">
        <thead>
          <tr>
            <th>Product</th>
            <th className="num">Qty</th>
            <th className="num">Unit price</th>
            <th className="num">Discount %</th>
            <th className="num">Line total</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={line.id}>
              <td style={{ minWidth: 220 }}>
                <SearchableSelect
                  value={line.productId}
                  options={products.map((p) => ({ value: p.id, label: p.name }))}
                  onChange={(v) => pickProduct(line.id, v)}
                  placeholder="Search products…"
                />
              </td>
              <td className="num">
                <input
                  className="input"
                  type="number"
                  min={1}
                  value={line.quantity}
                  onChange={(e) => updateLine(line.id, { quantity: Number(e.target.value) })}
                />
              </td>
              <td className="num">
                <input
                  className="input"
                  type="number"
                  value={line.unitPrice}
                  onChange={(e) => updateLine(line.id, { unitPrice: Number(e.target.value) })}
                />
              </td>
              <td className="num">
                <input
                  className="input"
                  type="number"
                  min={0}
                  max={100}
                  value={line.discountPct}
                  onChange={(e) => updateLine(line.id, { discountPct: Number(e.target.value) })}
                />
              </td>
              <td className="num">{formatCurrency(line.lineTotal, true)}</td>
              <td>
                <button className="link-btn" data-testid="remove-line-item" onClick={() => removeLine(line.id)}>
                  ✕
                </button>
              </td>
            </tr>
          ))}
          {lines.length === 0 && (
            <tr>
              <td colSpan={6} className="empty-cell">
                No line items yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <button className="btn btn-small" data-testid="add-line-item" onClick={addLine}>
        + Add line item
      </button>
      <div className="quote-total" data-testid="quote-total">
        Total: {formatCurrency(total, true)}
      </div>
    </div>
  );
}

export function QuoteLineItemsView({ lineItems }: { lineItems: QuoteLineItem[] }) {
  const products = getAllSync<Product>('products');
  const { lines, total } = computeQuoteTotals(lineItems);

  return (
    <div className="line-item-table">
      <table className="table">
        <thead>
          <tr>
            <th>Product</th>
            <th className="num">Qty</th>
            <th className="num">Unit price</th>
            <th className="num">Discount %</th>
            <th className="num">Line total</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => {
            const product = products.find((p) => p.id === line.productId);
            return (
              <tr key={line.id}>
                <td>
                  {product ? (
                    <Link to={`/products/${product.id}`}>{product.name}</Link>
                  ) : (
                    <span className="muted">{line.productName} (deleted product)</span>
                  )}
                </td>
                <td className="num">{line.quantity}</td>
                <td className="num">{formatCurrency(line.unitPrice, true)}</td>
                <td className="num">{line.discountPct}%</td>
                <td className="num">{formatCurrency(line.lineTotal, true)}</td>
              </tr>
            );
          })}
          {lines.length === 0 && (
            <tr>
              <td colSpan={5} className="empty-cell">
                No line items.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <div className="quote-total" data-testid="quote-total">
        Total: {formatCurrency(total, true)}
      </div>
    </div>
  );
}
