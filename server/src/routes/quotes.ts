import { Request, Router } from 'express';
import { store, newId } from '../db.js';
import { crudRouter } from './crud.js';
import { quoteApprovalSchema, quoteSchema, quoteSettingsSchema, quoteTransitionSchema } from '../schemas/quote.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { notFound, conflict, forbidden } from '../errors.js';
import { autoCloseDate } from '../utils.js';
import { Quote, QuoteEvent, QuoteLineItem, QuoteSettings, QUOTE_TRANSITIONS } from '../types.js';
import { approvalCleared, needsApproval, sameTerms, settingsOf } from '../quoteMath.js';

/** History lines kept per quote; the oldest go first. */
export const QUOTE_HISTORY_LIMIT = 60;
const DAY = 24 * 60 * 60 * 1000;

export const quoteSettingsNow = (): QuoteSettings => settingsOf(store.quoteSettings.all());

const withEvent = (quote: Pick<Quote, 'history'>, by: string, text: string, at = new Date().toISOString()): QuoteEvent[] =>
  [...(quote.history ?? []), { at, by, text }].slice(-QUOTE_HISTORY_LIMIT);

function buildLines(body: any): QuoteLineItem[] {
  return (body.lineItems ?? []).map((li: any) => {
    const product = store.products.get(li.productId);
    return {
      id: li.id ?? newId('qline'),
      productId: li.productId,
      productName: li.productName,
      quantity: li.quantity,
      unitPrice: li.unitPrice,
      discountPct: li.discountPct ?? 0,
      sku: li.sku ?? product?.sku,
      unit: li.unit ?? product?.unit ?? 'One-time',
    };
  });
}

/** The next number in the bank's series for this year: Q-2026-0016 after Q-2026-0015. */
export function nextQuoteNumber(year = new Date().getFullYear()): string {
  const prefix = `Q-${year}-`;
  const nums = store.quotes.all().map((q) => q.quoteNumber.startsWith(prefix) ? Number(q.quoteNumber.slice(prefix.length)) : NaN).filter((n) => Number.isFinite(n) && n < 100_000); // older numbers were six-digit time stamps, not a series
  return prefix + String((nums.length ? Math.max(...nums) : 0) + 1).padStart(4, '0');
}

function buildQuote(body: any, req: Request): Quote {
  const now = new Date();
  return {
    id: body.id ?? newId('quote'),
    quoteNumber: body.quoteNumber?.trim() || nextQuoteNumber(now.getFullYear()),
    accountId: body.accountId,
    dealId: body.dealId ?? null,
    lineItems: buildLines(body),
    status: body.status ?? 'Draft',
    validUntil: body.validUntil ?? new Date(now.getTime() + quoteSettingsNow().validityDays * DAY).toISOString(),
    createdAt: now.toISOString(),
    customFields: body.customFields,
    ownerId: body.ownerId ?? req.user!.id,
    approval: null,
    approvedBy: null,
    sentAt: null,
    decidedAt: null,
    rejectReason: null,
    history: [{ at: now.toISOString(), by: req.user!.name, text: `Created by ${req.user!.name}` }],
  };
}

export const quotesRouter: Router = crudRouter<Quote>({
  collection: store.quotes,
  entityLabel: 'Quote',
  auditAction: 'quote',
  createSchema: quoteSchema,
  buildCreate: (body, req) => {
    const quote = buildQuote(body, req);
    // Only a Draft can skip the approval rule; anything else must already be within the limit.
    if (quote.status !== 'Draft' && !approvalCleared(quote, quoteSettingsNow().discountLimit)) {
      throw conflict('approval_needed', 'A discount is above the bank’s limit. Save the quote as a draft and ask for approval first.');
    }
    if (quote.status === 'Sent') quote.sentAt = quote.createdAt;
    return quote;
  },
  buildUpdate: (body, id, req) => {
    const existing = store.quotes.get(id);
    if (!existing) throw notFound('Quote');
    if (existing.status === 'Accepted') throw conflict('quote_locked', 'An accepted quote cannot change. Duplicate it to quote again.');
    const built = buildQuote(body, req);
    const limit = quoteSettingsNow().discountLimit;
    const termsChanged = !sameTerms(existing.lineItems, built.lineItems);
    let history = existing.history ?? [];
    let approval = existing.approval ?? null;
    let approvedBy = existing.approvedBy ?? null;
    if (termsChanged) {
      history = withEvent({ history }, req.user!.name, 'Lines changed');
      if (!needsApproval(built, limit)) {
        approval = null;
        approvedBy = null;
      } else if (approval === 'approved') {
        approval = null;
        approvedBy = null;
        history = withEvent({ history }, req.user!.name, 'Discounts changed, so the approval was removed');
      }
    }
    return {
      ...built,
      id,
      quoteNumber: existing.quoteNumber,
      createdAt: existing.createdAt,
      // The status only moves through /transition, where the rules live.
      status: existing.status,
      ownerId: body.ownerId !== undefined ? body.ownerId : existing.ownerId ?? null,
      approval,
      approvedBy,
      sentAt: existing.sentAt ?? null,
      decidedAt: existing.decidedAt ?? null,
      rejectReason: existing.rejectReason ?? null,
      history,
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
    const { status, reason, note } = req.body as { status: Quote['status']; reason?: string; note?: string };
    if (!QUOTE_TRANSITIONS[quote.status].includes(status)) {
      throw conflict('illegal_transition', `Cannot move quote from ${quote.status} to ${status}.`);
    }
    const settings = quoteSettingsNow();
    if (status === 'Sent' && !approvalCleared(quote, settings.discountLimit)) {
      throw conflict('approval_needed', 'A discount is above the bank’s limit. It needs approval before the quote is sent.');
    }
    if (status === 'Rejected' && !reason) {
      throw conflict('reason_needed', 'Say why the customer rejected the quote.');
    }

    const now = new Date();
    const at = now.toISOString();
    const who = req.user!.name;
    const account = store.accounts.get(quote.accountId);
    const patch: Partial<Quote> = { status };
    let text = `Moved from ${quote.status} to ${status}`;
    if (status === 'Sent') {
      patch.sentAt = at;
      text = `Sent to ${account?.name ?? 'the customer'} by ${who}`;
    } else if (status === 'Accepted' || status === 'Rejected' || status === 'Expired') {
      patch.decidedAt = at;
      if (status === 'Rejected') patch.rejectReason = reason ?? null;
      text = status === 'Accepted' ? 'Customer accepted' : status === 'Rejected' ? `Rejected: ${reason}${note ? ` (${note})` : ''}` : 'Marked expired';
    } else if (status === 'Draft') {
      // Revising: a fresh validity period, and the old answer is cleared.
      Object.assign(patch, { sentAt: null, decidedAt: null, rejectReason: null, validUntil: new Date(now.getTime() + settings.validityDays * DAY).toISOString() });
      text = 'Back to draft to revise';
    }

    let closedDeal;
    if (status === 'Accepted' && quote.dealId) {
      const deal = store.deals.get(quote.dealId);
      if (deal && !deal.stage.startsWith('Closed')) {
        closedDeal = store.deals.replace(deal.id, autoCloseDate(deal.stage, {
          ...deal,
          stage: 'Closed Won',
          stageHistory: [...(deal.stageHistory ?? []), { stage: 'Closed Won', at, by: who, note: `Quote ${quote.quoteNumber} accepted` }].slice(-50),
        }));
        text += `; deal "${deal.name}" moved to Closed Won`;
        store.logAudit(who, 'quote.accept', `Accepted quote ${quote.quoteNumber} — deal "${deal.name}" auto-closed as Won`);
      } else if (deal) {
        store.logAudit(who, 'quote.accept', `Accepted quote ${quote.quoteNumber} (linked deal already ${deal.stage})`);
      } else {
        store.logAudit(who, 'quote.accept', `Accepted quote ${quote.quoteNumber}`);
      }
    } else {
      store.logAudit(who, 'quote.status', `Quote ${quote.quoteNumber} moved ${quote.status} → ${status}`);
    }
    patch.history = withEvent(quote, who, text, at);

    const updatedQuote = store.quotes.update(quote.id, patch)!;
    res.json({ quote: updatedQuote, deal: closedDeal });
  }
);

/**
 * Discount approval (maker-checker). `ask`: the quote's people ask for it. `approve` / `return`: only the bank's approver,
 * or an admin when the bank has not named one. Changing the discounts later removes an approval (see PUT).
 */
quotesRouter.post('/:id/approval', requireAuth, requireRole('admin', 'rep'), validateBody(quoteApprovalSchema), (req, res) => {
  const quote = store.quotes.get(req.params.id);
  if (!quote) throw notFound('Quote');
  const { decision, note } = req.body as { decision: 'ask' | 'approve' | 'return'; note?: string };
  const settings = quoteSettingsNow();
  const who = req.user!.name;
  if (quote.status !== 'Draft') throw conflict('not_draft', 'Only a draft quote can be approved.');
  if (!needsApproval(quote, settings.discountLimit)) throw conflict('approval_not_needed', `No discount is above ${settings.discountLimit}%, so no approval is needed.`);

  let patch: Partial<Quote>;
  if (decision === 'ask') {
    if (quote.approval === 'approved') throw conflict('already_approved', 'This quote is already approved.');
    patch = { approval: 'waiting', history: withEvent(quote, who, `Approval asked${note ? `: ${note}` : ''}`) };
    const approver = settings.approverId ? store.users.get(settings.approverId) : null;
    store.notifications.create({ id: newId('notif'), text: `${who} asks ${approver ? approver.name : 'an admin'} to approve the discount on quote ${quote.quoteNumber}`, read: false, when: new Date().toISOString() });
  } else {
    const mayDecide = settings.approverId ? req.user!.id === settings.approverId || req.user!.role === 'admin' : req.user!.role === 'admin';
    if (!mayDecide) throw forbidden('Only the bank’s quote approver can decide.');
    if (quote.approval !== 'waiting') throw conflict('not_waiting', 'Nobody has asked for approval on this quote.');
    patch = decision === 'approve'
      ? { approval: 'approved', approvedBy: who, history: withEvent(quote, who, `${who} approved the discounts${note ? `: ${note}` : ''}`) }
      : { approval: null, approvedBy: null, history: withEvent(quote, who, `${who} sent it back${note ? `: ${note}` : ''}`) };
    store.notifications.create({ id: newId('notif'), text: decision === 'approve' ? `${who} approved quote ${quote.quoteNumber}. It can be sent.` : `${who} sent quote ${quote.quoteNumber} back${note ? `: ${note}` : ''}`, read: false, when: new Date().toISOString() });
  }
  store.logAudit(who, 'quote.approval', `Quote ${quote.quoteNumber}: ${decision}`);
  res.json(store.quotes.update(quote.id, patch));
});

/** Setup → Quote settings: tax, validity, discount limit and approver. */
export const quoteSettingsRouter: Router = Router();

quoteSettingsRouter.get('/', requireAuth, (_req, res) => {
  res.json(quoteSettingsNow());
});

quoteSettingsRouter.put('/', requireAuth, requireRole('admin'), validateBody(quoteSettingsSchema), (req, res) => {
  const body = req.body as Omit<QuoteSettings, 'id'>;
  if (body.approverId && !store.users.get(body.approverId)) throw conflict('unknown_user', 'The approver is not a user of this bank.');
  const row: QuoteSettings = { ...body, id: 'quote-settings' };
  if (store.quoteSettings.get(row.id)) store.quoteSettings.replace(row.id, row);
  else store.quoteSettings.create(row);
  store.logAudit(req.user!.name, 'quoteSettings.update', `Quote settings: ${row.taxName} ${row.taxPercent}%, valid ${row.validityDays} days, approval above ${row.discountLimit}%`);
  res.json(quoteSettingsNow());
});
