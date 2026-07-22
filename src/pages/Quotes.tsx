import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAll } from '../data/store';
import { Account, Quote } from '../types';
import { SkeletonRows } from '../components/Spinner';
import { computeQuoteTotals, QUOTE_STATUS_PILL } from '../components/QuoteLineItems';
import { formatCurrency, formatDate } from '../utils';

export function Quotes() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    (async () => {
      const [q, a] = await Promise.all([getAll<Quote>('quotes'), getAll<Account>('accounts')]);
      setQuotes(q);
      setAccounts(a);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 350);
    return () => clearTimeout(t);
  }, [query]);

  const accountName = (id: string) => accounts.find((a) => a.id === id)?.name ?? '—';

  const sorted = useMemo(
    () => [...quotes].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [quotes]
  );

  const filtered = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter(
      (quote) => quote.quoteNumber.toLowerCase().includes(q) || accountName(quote.accountId).toLowerCase().includes(q)
    );
  }, [sorted, debouncedQuery, accounts]);

  return (
    <div data-testid="quotes-page">
      <div className="page-header">
        <h1>Quotes</h1>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={() => navigate('/quotes/new')}>
            + New Quote
          </button>
        </div>
      </div>

      <div className="toolbar">
        <input
          type="search"
          className="input search-input"
          placeholder="Search quote #, account…"
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
                <th>Quote #</th>
                <th>Account</th>
                <th>Status</th>
                <th className="num">Line items</th>
                <th className="num">Total</th>
                <th>Valid until</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((quote) => (
                <tr key={quote.id} className="row-clickable" onClick={() => navigate(`/quotes/${quote.id}`)}>
                  <td>
                    <code>{quote.quoteNumber}</code>
                  </td>
                  <td>{accountName(quote.accountId)}</td>
                  <td>
                    <span className={`pill ${QUOTE_STATUS_PILL[quote.status]}`}>{quote.status}</span>
                  </td>
                  <td className="num">{quote.lineItems.length}</td>
                  <td className="num">{formatCurrency(computeQuoteTotals(quote.lineItems).total, true)}</td>
                  <td>{formatDate(quote.validUntil)}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty-cell">
                    No quotes match “{query}”.
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
