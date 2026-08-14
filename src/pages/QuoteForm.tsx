import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getAllSync, newId, upsert } from '../data/store';
import { Account, Deal, Product, Quote } from '../types';
import { QuoteBuilder, QuoteDraft } from '../components/QuoteBuilder';
import { validateCustomFields } from '../components/CustomFieldsSection';
import { useToast } from '../components/Toast';

export function QuoteForm() {
  const navigate = useNavigate();
  const toast = useToast();

  const accounts = getAllSync<Account>('accounts');
  const products = getAllSync<Product>('products');
  const allDeals = getAllSync<Deal>('deals');

  const [draft, setDraft] = useState<QuoteDraft>({
    quoteNumber: '',
    accountId: '',
    dealId: null,
    validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    lineItems: [],
    customFields: {},
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Cascading select: options scoped to the chosen account; changing the account
  // resets dealId in the same update (owned by QuoteBuilder), so a stale deal from
  // a different account can never be submitted.
  const accountDeals = useMemo(() => allDeals.filter((d) => d.accountId === draft.accountId), [allDeals, draft.accountId]);

  const submit = async () => {
    if (!draft.accountId) {
      setError('Account is required.');
      return;
    }
    const validItems = draft.lineItems.filter((li) => li.productId && li.quantity > 0);
    if (validItems.length === 0) {
      setError('Add at least one line item with a product and a quantity greater than 0.');
      return;
    }
    const cErrs = validateCustomFields('quotes', 'form', draft.customFields);
    if (Object.keys(cErrs).length > 0) {
      setError(Object.values(cErrs)[0]);
      return;
    }
    setError(null);

    const quote: Quote = {
      id: newId('quote'),
      quoteNumber: draft.quoteNumber.trim() || `Q-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`,
      accountId: draft.accountId,
      dealId: draft.dealId,
      lineItems: validItems,
      status: 'Draft',
      validUntil: draft.validUntil,
      createdAt: new Date().toISOString(),
      customFields: draft.customFields,
    };
    setBusy(true);
    await upsert('quotes', quote);
    toast.push('success', `Quote "${quote.quoteNumber}" created.`);
    navigate(`/quotes/${quote.id}`);
  };

  return (
    <div data-testid="quote-form-page">
      <nav className="breadcrumbs">
        <Link to="/quotes">Quotes</Link> <span>/</span> <span>New quote</span>
      </nav>
      <div className="page-header">
        <h1>New quote</h1>
      </div>

      <QuoteBuilder
        draft={draft}
        onDraftChange={setDraft}
        status="Draft"
        accounts={accounts}
        accountDeals={accountDeals}
        products={products}
        showQuoteNumberField
        error={error}
        testId="quote-builder"
        footer={
          <>
            <button className="btn" onClick={() => navigate('/quotes')}>
              Cancel
            </button>
            <button className="btn btn-primary" disabled={busy} onClick={submit}>
              {busy ? 'Creating…' : 'Create quote'}
            </button>
          </>
        }
      />
    </div>
  );
}
