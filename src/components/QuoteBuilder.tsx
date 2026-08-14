import { ReactNode } from 'react';
import { SplitPane } from './SplitPane';
import { QuoteDocument } from './QuoteDocument';
import { QuoteLineItemsEditor } from './QuoteLineItems';
import { SearchableSelect } from './Select';
import { DatePicker } from './DatePicker';
import { CustomFieldsSection, CustomFieldValues } from './CustomFieldsSection';
import { Account, Deal, Product, Quote, QuoteLineItem, QuoteStatus } from '../types';

export interface QuoteDraft {
  quoteNumber: string;
  accountId: string;
  dealId: string | null;
  validUntil: string;
  lineItems: QuoteLineItem[];
  customFields: CustomFieldValues;
}

interface QuoteBuilderProps {
  draft: QuoteDraft;
  onDraftChange: (next: QuoteDraft) => void;
  /** Drives the live preview's status pill/stepper context — the actual quote's status, or 'Draft' while creating. */
  status: QuoteStatus;
  accounts: Account[];
  /** Deals already scoped to draft.accountId — the account→deal cascade stays owned by the caller. */
  accountDeals: Deal[];
  products: Product[];
  showQuoteNumberField: boolean;
  error?: string | null;
  footer?: ReactNode;
  testId?: string;
}

/** Line-item editor (left) + live-updating QuoteDocument preview (right) — shared by quote creation and inline editing. */
export function QuoteBuilder({
  draft,
  onDraftChange,
  status,
  accounts,
  accountDeals,
  products,
  showQuoteNumberField,
  error,
  footer,
  testId,
}: QuoteBuilderProps) {
  const account = accounts.find((a) => a.id === draft.accountId);
  const deal = accountDeals.find((d) => d.id === draft.dealId);
  const previewQuote: Quote = {
    id: 'preview',
    quoteNumber: draft.quoteNumber,
    accountId: draft.accountId,
    dealId: draft.dealId,
    lineItems: draft.lineItems,
    status,
    validUntil: draft.validUntil,
    createdAt: new Date().toISOString(),
    customFields: draft.customFields,
  };

  return (
    <div data-testid={testId}>
      {error && (
        <div className="banner banner-error" role="alert">
          {error}
        </div>
      )}
      <SplitPane
        testId="quote-builder-split"
        list={
          <div className="split-pane-form-pane">
            <div className="form-grid">
              {showQuoteNumberField && (
                <div className="field">
                  <span className="field-label">Quote number</span>
                  <input
                    className="input"
                    data-testid="quote-number"
                    placeholder="Auto-generated if left empty"
                    value={draft.quoteNumber}
                    onChange={(e) => onDraftChange({ ...draft, quoteNumber: e.target.value })}
                  />
                </div>
              )}
              <div className="field">
                <span className="field-label">Account{showQuoteNumberField && ' *'}</span>
                <SearchableSelect
                  value={draft.accountId}
                  options={accounts.map((a) => ({ value: a.id, label: a.name }))}
                  onChange={(v) => onDraftChange({ ...draft, accountId: v, dealId: null })}
                  placeholder="Search accounts…"
                  testId="quote-account"
                />
              </div>
              <div className="field">
                <span className="field-label">Linked deal</span>
                <SearchableSelect
                  value={draft.dealId ?? ''}
                  options={[{ value: '', label: 'No deal (optional)' }, ...accountDeals.map((d) => ({ value: d.id, label: d.name }))]}
                  onChange={(v) => onDraftChange({ ...draft, dealId: v || null })}
                  placeholder="Search this account's deals…"
                  emptyText={draft.accountId ? 'This account has no deals yet' : 'Choose an account first'}
                  testId="quote-deal"
                />
              </div>
              <div className="field">
                <span className="field-label">Valid until</span>
                <DatePicker
                  value={draft.validUntil}
                  onChange={(iso) => onDraftChange({ ...draft, validUntil: iso })}
                  testId="quote-valid-until"
                />
              </div>
              <CustomFieldsSection
                module="quotes"
                target={showQuoteNumberField ? 'form' : 'detail'}
                mode="edit"
                values={draft.customFields}
                onChange={(k, v) => onDraftChange({ ...draft, customFields: { ...draft.customFields, [k]: v } })}
              />
            </div>

            <h3>Line items</h3>
            <QuoteLineItemsEditor
              lineItems={draft.lineItems}
              onChange={(items) => onDraftChange({ ...draft, lineItems: items })}
              products={products}
            />

            {footer && <div className="form-actions">{footer}</div>}
          </div>
        }
        detail={<QuoteDocument quote={previewQuote} account={account} deal={deal} showTotalTestId={false} />}
      />
    </div>
  );
}
