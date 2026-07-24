import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getAllSync, newId, upsert } from '../data/store';
import { Account, Deal, Product, Quote, QuoteLineItem } from '../types';
import { SearchableSelect } from '../components/Select';
import { DatePicker } from '../components/DatePicker';
import { QuoteLineItemsEditor } from '../components/QuoteLineItems';
import { CustomFieldsSection, CustomFieldValues, validateCustomFields } from '../components/CustomFieldsSection';
import { useToast } from '../components/Toast';
import { useAuth } from '../auth/AuthContext';

export function QuoteForm() {
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();

  const accounts = getAllSync<Account>('accounts');
  const products = getAllSync<Product>('products');
  const allDeals = getAllSync<Deal>('deals');

  const [accountId, setAccountId] = useState('');
  const [dealId, setDealId] = useState<string | null>(null);
  const [quoteNumber, setQuoteNumber] = useState('');
  const [validUntil, setValidUntil] = useState(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString());
  const [lineItems, setLineItems] = useState<QuoteLineItem[]>([]);
  const [customFields, setCustomFields] = useState<CustomFieldValues>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Cascading select: options scoped to the chosen account; changing the account
  // (below) resets dealId in the same update, so a stale deal from a different
  // account can never be submitted.
  const accountDeals = useMemo(() => allDeals.filter((d) => d.accountId === accountId), [allDeals, accountId]);

  const submit = async () => {
    if (!accountId) {
      setError('Account is required.');
      return;
    }
    const validItems = lineItems.filter((li) => li.productId && li.quantity > 0);
    if (validItems.length === 0) {
      setError('Add at least one line item with a product and a quantity greater than 0.');
      return;
    }
    const cErrs = validateCustomFields('quotes', 'form', customFields);
    if (Object.keys(cErrs).length > 0) {
      setError(Object.values(cErrs)[0]);
      return;
    }
    setError(null);

    const quote: Quote = {
      id: newId('quote'),
      quoteNumber: quoteNumber.trim() || `Q-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`,
      accountId,
      dealId,
      lineItems: validItems,
      status: 'Draft',
      validUntil,
      createdAt: new Date().toISOString(),
      customFields,
    };
    setBusy(true);
    await upsert('quotes', quote);
    const accountName = accounts.find((a) => a.id === accountId)?.name ?? '—';
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

      <div className="card form-card">
        {error && (
          <div className="banner banner-error" role="alert">
            {error}
          </div>
        )}
        <div className="form-grid">
          <div className="field">
            <span className="field-label">Account *</span>
            <SearchableSelect
              value={accountId}
              options={accounts.map((a) => ({ value: a.id, label: a.name }))}
              onChange={(v) => {
                setAccountId(v);
                setDealId(null);
              }}
              placeholder="Search accounts…"
              testId="quote-account"
            />
          </div>
          <div className="field">
            <span className="field-label">Linked deal</span>
            <SearchableSelect
              value={dealId ?? ''}
              options={[{ value: '', label: 'No deal (optional)' }, ...accountDeals.map((d) => ({ value: d.id, label: d.name }))]}
              onChange={(v) => setDealId(v || null)}
              placeholder="Search this account's deals…"
              emptyText={accountId ? "This account has no deals yet" : 'Choose an account first'}
              testId="quote-deal"
            />
          </div>
          <div className="field">
            <span className="field-label">Quote number</span>
            <input
              className="input"
              data-testid="quote-number"
              placeholder="Auto-generated if left empty"
              value={quoteNumber}
              onChange={(e) => setQuoteNumber(e.target.value)}
            />
          </div>
          <div className="field">
            <span className="field-label">Valid until</span>
            <DatePicker value={validUntil} onChange={setValidUntil} testId="quote-valid-until" />
          </div>
          <CustomFieldsSection
            module="quotes"
            target="form"
            mode="edit"
            values={customFields}
            onChange={(k, v) => setCustomFields({ ...customFields, [k]: v })}
          />
        </div>

        <h3>Line items</h3>
        <QuoteLineItemsEditor lineItems={lineItems} onChange={setLineItems} products={products} />

        <div className="form-actions">
          <button className="btn" onClick={() => navigate('/quotes')}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={busy} onClick={submit}>
            {busy ? 'Creating…' : 'Create quote'}
          </button>
        </div>
      </div>
    </div>
  );
}
