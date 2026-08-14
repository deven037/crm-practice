import { Link } from 'react-router-dom';
import { Printer } from 'lucide-react';
import { getAllSync } from '../data/store';
import { Account, Deal, Product, Quote } from '../types';
import { computeQuoteTotals, QUOTE_STATUS_PILL } from './QuoteLineItems';
import { formatCurrency, formatDate } from '../utils';

interface QuoteDocumentProps {
  quote: Quote;
  account?: Account;
  deal?: Deal;
  showPrintButton?: boolean;
  /** False when rendered as a live preview alongside an editable line-item table that already owns the "quote-total" testid. */
  showTotalTestId?: boolean;
}

/** Invoice-shaped read-only render of a quote — used by the QuoteDetail view mode and as the live preview inside QuoteBuilder. */
export function QuoteDocument({ quote, account, deal, showPrintButton = false, showTotalTestId = true }: QuoteDocumentProps) {
  const products = getAllSync<Product>('products');
  const { lines, total } = computeQuoteTotals(quote.lineItems);

  return (
    <div className="quote-document print-area" data-testid="quote-document">
      {showPrintButton && (
        <div className="no-print" style={{ textAlign: 'right', marginBottom: 12 }}>
          <button className="btn btn-primary" data-testid="print-quote-btn" onClick={() => window.print()}>
            <Printer size={14} /> Print / Save as PDF
          </button>
        </div>
      )}

      <div className="quote-doc-header">
        <div className="quote-doc-brand">Practice CRM</div>
        <div className="quote-doc-meta">
          <h2>Quote {quote.quoteNumber || '(unsaved)'}</h2>
          <span className={`pill ${QUOTE_STATUS_PILL[quote.status]}`}>{quote.status}</span>
        </div>
      </div>

      <div className="quote-doc-parties">
        <div>
          <div className="quote-doc-label">Bill to</div>
          <div className="quote-doc-strong">{account?.name ?? '—'}</div>
        </div>
        <div>
          <div className="quote-doc-label">Linked deal</div>
          <div className="quote-doc-strong">{deal?.name ?? '—'}</div>
        </div>
        <div>
          <div className="quote-doc-label">Valid until</div>
          <div className="quote-doc-strong">{formatDate(quote.validUntil)}</div>
        </div>
      </div>

      <div className="quote-doc-table">
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
                      <span className="muted">{line.productName || '—'}</span>
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
                  No line items yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="quote-doc-total-row">
        <span className="muted">Total</span>
        <span className="quote-doc-total" data-testid={showTotalTestId ? 'quote-total' : undefined}>
          {formatCurrency(total, true)}
        </span>
      </div>
    </div>
  );
}
