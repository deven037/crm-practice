import { Router } from 'express';
import { store, newId } from '../db.js';
import { crudRouter } from './crud.js';
import { quoteSchema, quoteTransitionSchema } from '../schemas/quote.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { notFound, conflict } from '../errors.js';
import { autoCloseDate } from '../utils.js';
import { Quote, QuoteLineItem, QUOTE_TRANSITIONS } from '../types.js';

function buildQuote(body: any): Quote {
  const lineItems: QuoteLineItem[] = (body.lineItems ?? []).map((li: any) => ({
    id: li.id ?? newId('qline'),
    productId: li.productId,
    productName: li.productName,
    quantity: li.quantity,
    unitPrice: li.unitPrice,
    discountPct: li.discountPct ?? 0,
  }));
  return {
    id: body.id ?? newId('quote'),
    quoteNumber: body.quoteNumber?.trim() || `Q-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`,
    accountId: body.accountId,
    dealId: body.dealId ?? null,
    lineItems,
    status: body.status ?? 'Draft',
    validUntil: body.validUntil ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date().toISOString(),
    customFields: body.customFields,
  };
}

export const quotesRouter: Router = crudRouter<Quote>({
  collection: store.quotes,
  entityLabel: 'Quote',
  auditAction: 'quote',
  createSchema: quoteSchema,
  buildCreate: (body) => buildQuote(body),
  buildUpdate: (body, id) => {
    const existing = store.quotes.get(id);
    return {
      ...buildQuote(body),
      id,
      quoteNumber: existing?.quoteNumber ?? buildQuote(body).quoteNumber,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    };
  },
  describe: (q) => q.quoteNumber,
});

quotesRouter.delete('/:id', requireAuth, requireRole('admin', 'rep'), (req, res) => {
  const quote = store.quotes.get(req.params.id);
  if (!quote) throw notFound('Quote');
  store.quotes.remove(quote.id);
  store.logAudit(req.user!.name, 'quote.delete', `Deleted quote ${quote.quoteNumber}`);
  res.status(204).end();
});

quotesRouter.post(
  '/:id/transition',
  requireAuth,
  requireRole('admin', 'rep'),
  validateBody(quoteTransitionSchema),
  (req, res) => {
    const quote = store.quotes.get(req.params.id);
    if (!quote) throw notFound('Quote');
    const { status } = req.body as { status: Quote['status'] };
    if (!QUOTE_TRANSITIONS[quote.status].includes(status)) {
      throw conflict('illegal_transition', `Cannot move quote from ${quote.status} to ${status}.`);
    }

    const updatedQuote = store.quotes.update(quote.id, { status })!;
    let closedDeal;

    if (status === 'Accepted' && quote.dealId) {
      const deal = store.deals.get(quote.dealId);
      if (deal && !deal.stage.startsWith('Closed')) {
        closedDeal = store.deals.replace(deal.id, autoCloseDate(deal.stage, { ...deal, stage: 'Closed Won' }));
        store.logAudit(
          req.user!.name,
          'quote.accept',
          `Accepted quote ${quote.quoteNumber} — deal "${deal.name}" auto-closed as Won`
        );
      } else if (deal) {
        store.logAudit(
          req.user!.name,
          'quote.accept',
          `Accepted quote ${quote.quoteNumber} (linked deal already ${deal.stage})`
        );
      } else {
        store.logAudit(req.user!.name, 'quote.accept', `Accepted quote ${quote.quoteNumber}`);
      }
    } else {
      store.logAudit(req.user!.name, 'quote.status', `Quote ${quote.quoteNumber} moved ${quote.status} → ${status}`);
    }

    res.json({ quote: updatedQuote, deal: closedDeal });
  }
);
