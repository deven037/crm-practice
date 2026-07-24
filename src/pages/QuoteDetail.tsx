import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getAllSync, getById, removeMany, upsert } from '../data/store';
import { apiFetch } from '../data/apiFetch';
import { Account, Deal, Product, Quote, QuoteLineItem, QuoteStatus, QUOTE_TRANSITIONS } from '../types';
import { SearchableSelect } from '../components/Select';
import { DatePicker } from '../components/DatePicker';
import { QuoteLineItemsEditor, QuoteLineItemsView, QUOTE_STATUS_PILL } from '../components/QuoteLineItems';
import { CustomFieldsSection } from '../components/CustomFieldsSection';
import { Modal } from '../components/Modal';
import { Spinner } from '../components/Spinner';
import { useToast } from '../components/Toast';
import { useAuth } from '../auth/AuthContext';
import { formatDate } from '../utils';

export function QuoteDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Quote | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [dealAlreadyClosedNote, setDealAlreadyClosedNote] = useState(false);

  useEffect(() => {
    (async () => {
      const q = await getById<Quote>('quotes', id ?? '');
      if (!q) setNotFound(true);
      else setQuote(q);
    })();
  }, [id]);

  if (notFound) {
    return (
      <div className="empty-cell">
        Quote not found. <Link to="/quotes">Back to quotes</Link>
      </div>
    );
  }
  if (!quote) return <Spinner label="Loading quote…" />;

  const accounts = getAllSync<Account>('accounts');
  const deals = getAllSync<Deal>('deals');
  const products = getAllSync<Product>('products');
  const account = accounts.find((a) => a.id === quote.accountId);
  const linkedDeal = deals.find((d) => d.id === quote.dealId);
  const accountDeals = deals.filter((d) => d.accountId === (draft?.accountId ?? quote.accountId));

  const save = async () => {
    if (!draft) return;
    await upsert('quotes', draft);
    setQuote(draft);
    setEditing(false);
    toast.push('success', 'Quote updated.');
  };

  // Transition legality (QUOTE_TRANSITIONS) and the accept-auto-closes-linked-deal side
  // effect are enforced server-side (server/src/routes/quotes.ts) — this just calls it
  // and syncs local state from the authoritative response.
  const transition = async (next: QuoteStatus) => {
    const result = await apiFetch<{ quote: Quote; deal?: Deal }>(`/quotes/${quote.id}/transition`, {
      method: 'POST',
      body: JSON.stringify({ status: next }),
    });
    setQuote(result.quote);

    if (next === 'Accepted' && quote.dealId) {
      await getById<Deal>('deals', quote.dealId); // refresh the cache so the linked-deal view reflects the new stage
      if (result.deal) {
        setDealAlreadyClosedNote(false);
        toast.push('success', `Quote accepted. Deal "${result.deal.name}" was automatically closed as Won.`);
      } else {
        setDealAlreadyClosedNote(true);
        toast.push('info', 'Quote accepted. Linked deal was already closed — no change made.');
      }
    } else if (next === 'Accepted') {
      toast.push('success', `Quote "${quote.quoteNumber}" accepted.`);
    } else {
      toast.push('success', `Quote moved to ${next}.`);
    }
  };

  const doDelete = async () => {
    await removeMany('quotes', [quote.id]);
    toast.push('success', `Quote "${quote.quoteNumber}" deleted.`);
    navigate('/quotes');
  };

  return (
    <div data-testid="quote-detail-page">
      <nav className="breadcrumbs">
        <Link to="/quotes">Quotes</Link> <span>/</span> <span>{quote.quoteNumber}</span>
      </nav>

      <div className="page-header">
        <h1>{quote.quoteNumber}</h1>
        <div className="page-actions">
          <span className={`pill ${QUOTE_STATUS_PILL[quote.status]}`} data-testid="quote-status">
            {quote.status}
          </span>
          {!editing ? (
            <>
              <button
                className="btn"
                data-testid="edit-quote-btn"
                onClick={() => {
                  setDraft({ ...quote });
                  setEditing(true);
                }}
              >
                ✏️ Edit
              </button>
              <button className="btn btn-danger" data-testid="delete-quote-btn" onClick={() => setDeleting(true)}>
                🗑 Delete
              </button>
            </>
          ) : (
            <>
              <button className="btn" onClick={() => setEditing(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" data-testid="save-quote-btn" onClick={save}>
                Save
              </button>
            </>
          )}
        </div>
      </div>

      <div className="card">
        {!editing ? (
          <dl className="detail-list">
            <dt>Account</dt>
            <dd>{account ? <Link to={`/accounts/${account.id}`}>{account.name}</Link> : '—'}</dd>
            <dt>Linked deal</dt>
            <dd>
              {linkedDeal ? <Link to={`/deals/${linkedDeal.id}`}>{linkedDeal.name}</Link> : '—'}
              {dealAlreadyClosedNote && (
                <span className="muted"> — this quote's linked deal was already closed when accepted.</span>
              )}
            </dd>
            <dt>Valid until</dt>
            <dd>{formatDate(quote.validUntil)}</dd>
            <dt>Created</dt>
            <dd>{formatDate(quote.createdAt)}</dd>
            <CustomFieldsSection module="quotes" target="detail" mode="view" values={quote.customFields ?? {}} />
          </dl>
        ) : (
          draft && (
            <div className="form-grid">
              <div className="field">
                <span className="field-label">Account</span>
                <SearchableSelect
                  value={draft.accountId}
                  options={accounts.map((a) => ({ value: a.id, label: a.name }))}
                  onChange={(v) => setDraft({ ...draft, accountId: v, dealId: null })}
                  placeholder="Search accounts…"
                />
              </div>
              <div className="field">
                <span className="field-label">Linked deal</span>
                <SearchableSelect
                  value={draft.dealId ?? ''}
                  options={[{ value: '', label: 'No deal (optional)' }, ...accountDeals.map((d) => ({ value: d.id, label: d.name }))]}
                  onChange={(v) => setDraft({ ...draft, dealId: v || null })}
                  placeholder="Search this account's deals…"
                  emptyText="This account has no deals yet"
                />
              </div>
              <div className="field">
                <span className="field-label">Valid until</span>
                <DatePicker value={draft.validUntil} onChange={(iso) => setDraft({ ...draft, validUntil: iso })} />
              </div>
              <CustomFieldsSection
                module="quotes"
                target="detail"
                mode="edit"
                values={draft.customFields ?? {}}
                onChange={(k, v) => setDraft({ ...draft, customFields: { ...draft.customFields, [k]: v } })}
              />
            </div>
          )
        )}
      </div>

      <div className="card">
        <h3>Line items</h3>
        {!editing ? (
          <QuoteLineItemsView lineItems={quote.lineItems} />
        ) : (
          draft && (
            <QuoteLineItemsEditor
              lineItems={draft.lineItems}
              onChange={(items: QuoteLineItem[]) => setDraft({ ...draft, lineItems: items })}
              products={products}
            />
          )
        )}
      </div>

      <div className="card">
        <div className="transition-row">
          <span className="muted">Move to:</span>
          {QUOTE_TRANSITIONS[quote.status].map((next) => (
            <button key={next} className="btn" onClick={() => transition(next)}>
              {next}
            </button>
          ))}
          {QUOTE_TRANSITIONS[quote.status].length === 0 && <span className="muted">No further transitions (terminal status).</span>}
        </div>
      </div>

      {deleting && (
        <Modal
          title={`Delete quote — ${quote.quoteNumber}`}
          onClose={() => setDeleting(false)}
          footer={
            <>
              <button className="btn" onClick={() => setDeleting(false)}>
                Cancel
              </button>
              <button className="btn btn-danger" data-testid="confirm-delete-btn" onClick={doDelete}>
                Delete quote
              </button>
            </>
          }
        >
          <p>Delete “{quote.quoteNumber}”? This cannot be undone.</p>
        </Modal>
      )}
    </div>
  );
}
