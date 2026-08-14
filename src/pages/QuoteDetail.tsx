import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Pencil, Trash2 } from 'lucide-react';
import { getAllSync, getById, removeMany, upsert } from '../data/store';
import { apiFetch } from '../data/apiFetch';
import { Account, Deal, Product, Quote, QuoteStatus, QUOTE_TRANSITIONS } from '../types';
import { QuoteBuilder, QuoteDraft } from '../components/QuoteBuilder';
import { QuoteDocument } from '../components/QuoteDocument';
import { QUOTE_STATUS_PILL } from '../components/QuoteLineItems';
import { ProcessStepper, ProcessStepDef } from '../components/ProcessStepper';
import { Modal } from '../components/Modal';
import { Spinner } from '../components/Spinner';
import { useToast } from '../components/Toast';
import { useRecentlyViewed } from '../hooks/useRecentlyViewed';

const STEP_ORDER = ['Draft', 'Sent', 'Accepted'];

function quoteSteps(status: QuoteStatus): ProcessStepDef[] {
  const terminal = status === 'Rejected' || status === 'Expired';
  const currentIndex = terminal ? 2 : STEP_ORDER.indexOf(status);
  return STEP_ORDER.map((label, i) => ({
    id: label,
    label: label === 'Accepted' && terminal ? status : label,
    state: i < currentIndex ? 'completed' : i === currentIndex ? 'current' : 'locked',
  }));
}

export function QuoteDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<QuoteDraft | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [dealAlreadyClosedNote, setDealAlreadyClosedNote] = useState(false);
  const { recordView } = useRecentlyViewed();

  useEffect(() => {
    (async () => {
      const q = await getById<Quote>('quotes', id ?? '');
      if (!q) setNotFound(true);
      else setQuote(q);
    })();
  }, [id]);

  useEffect(() => {
    if (quote) recordView({ module: 'quotes', id: quote.id, label: quote.quoteNumber, link: `/quotes/${quote.id}`, meta: { Status: quote.status } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quote?.id]);

  if (notFound) {
    return (
      <div className="empty-cell">
        Quote not found. <Link to="/quotes">Back to quotes</Link>
      </div>
    );
  }
  if (!quote) return <Spinner label="Loading quote…" />;

  const accounts = getAllSync<Account>('accounts');
  const allDeals = getAllSync<Deal>('deals');
  const products = getAllSync<Product>('products');
  const account = accounts.find((a) => a.id === quote.accountId);
  const linkedDeal = allDeals.find((d) => d.id === quote.dealId);
  const accountDeals = allDeals.filter((d) => d.accountId === (draft?.accountId ?? quote.accountId));

  const startEdit = () => {
    setDraft({
      quoteNumber: quote.quoteNumber,
      accountId: quote.accountId,
      dealId: quote.dealId ?? null,
      validUntil: quote.validUntil,
      lineItems: quote.lineItems,
      customFields: quote.customFields ?? {},
    });
    setEditing(true);
  };

  const save = async () => {
    if (!draft) return;
    const next: Quote = {
      ...quote,
      accountId: draft.accountId,
      dealId: draft.dealId,
      validUntil: draft.validUntil,
      lineItems: draft.lineItems,
      customFields: draft.customFields,
    };
    await upsert('quotes', next);
    setQuote(next);
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
              <button className="btn" data-testid="edit-quote-btn" onClick={startEdit}>
                <Pencil size={14} /> Edit
              </button>
              <button className="btn btn-danger" data-testid="delete-quote-btn" onClick={() => setDeleting(true)}>
                <Trash2 size={14} /> Delete
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

      <div className="no-print">
        <ProcessStepper testId="quote-status-stepper" steps={quoteSteps(quote.status)} showLegend />
      </div>

      {editing && draft ? (
        <QuoteBuilder
          draft={draft}
          onDraftChange={setDraft}
          status={quote.status}
          accounts={accounts}
          accountDeals={accountDeals}
          products={products}
          showQuoteNumberField={false}
          testId="quote-builder"
        />
      ) : (
        <>
          <QuoteDocument quote={quote} account={account} deal={linkedDeal} showPrintButton />
          {dealAlreadyClosedNote && (
            <p className="muted" style={{ marginTop: 8 }}>
              This quote's linked deal was already closed when accepted.
            </p>
          )}
        </>
      )}

      <div className="card no-print">
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
