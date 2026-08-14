import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAll, removeMany } from '../data/store';
import { Account, Quote } from '../types';
import { SkeletonRows } from '../components/Spinner';
import { BulkActionsBar } from '../components/BulkActionsBar';
import { ToolBoxPanel } from '../components/ToolBoxPanel';
import { useToast } from '../components/Toast';
import { computeQuoteTotals, QUOTE_STATUS_PILL } from '../components/QuoteLineItems';
import { classNames, formatCurrency, formatDate } from '../utils';

export function Quotes() {
  const navigate = useNavigate();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selected, setSelected] = useState<string[]>([]);

  const load = async () => {
    setLoading(true);
    const [q, a] = await Promise.all([getAll<Quote>('quotes'), getAll<Account>('accounts')]);
    setQuotes(q);
    setAccounts(a);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const bulkDelete = async () => {
    if (!window.confirm(`Delete ${selected.length} selected quote(s)? This cannot be undone.`)) return;
    await removeMany('quotes', selected);
    toast.push('success', `${selected.length} quote(s) deleted.`);
    setSelected([]);
    load();
  };

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
          <button className="btn btn-create" onClick={() => navigate('/quotes/new')}>
            + New Quote
          </button>
        </div>
      </div>

      <ToolBoxPanel
        module="quotes"
        links={[
          { label: 'Custom Fields', to: '/admin/objects/quotes' },
          { label: 'Customise Page Layout', to: '/setup/layouts/quotes' },
        ]}
      />

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
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th className="checkbox-cell">
                    <input
                      type="checkbox"
                      aria-label="Select all"
                      checked={filtered.length > 0 && filtered.every((q) => selected.includes(q.id))}
                      onChange={() =>
                        setSelected((sel) =>
                          filtered.every((q) => sel.includes(q.id)) ? sel.filter((id) => !filtered.some((q) => q.id === id)) : [...new Set([...sel, ...filtered.map((q) => q.id)])]
                        )
                      }
                    />
                  </th>
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
                  <tr
                    key={quote.id}
                    className={classNames('row-clickable', selected.includes(quote.id) && 'row-selected')}
                    onClick={() => navigate(`/quotes/${quote.id}`)}
                  >
                    <td className="checkbox-cell" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        aria-label={`Select ${quote.quoteNumber}`}
                        checked={selected.includes(quote.id)}
                        onChange={() =>
                          setSelected((sel) => (sel.includes(quote.id) ? sel.filter((id) => id !== quote.id) : [...sel, quote.id]))
                        }
                      />
                    </td>
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
                    <td colSpan={7} className="empty-cell">
                      No quotes match “{query}”.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <BulkActionsBar count={selected.length} onClear={() => setSelected([])}>
            <button className="btn btn-danger" onClick={bulkDelete}>
              Delete
            </button>
          </BulkActionsBar>
        </>
      )}
    </div>
  );
}
