import { describe, expect, it, vi } from 'vitest';

vi.mock('../../data/store', () => ({
  getAllSync: () => [],
  bankProfileSync: () => ({ name: 'Harbor Bank', logoUrl: null, color: null, currency: 'INR', locale: 'en-IN' }),
}));

import { Quote, QuoteLineItem } from '../../types';
import { needsApproval, quoteSums, sameTerms, settingsOf } from './quoteMath';
import { filterTest, mayApprove, money, previewNumber, quoteGroups, statusTotals, validityOf } from './quoteLogic';
import { familyHue, productStats, skuSuggest } from '../products/productLogic';

const DAY = 86_400_000;
const NOW = Date.parse('2026-11-18T10:00:00Z');
const iso = (days: number) => new Date(NOW + days * DAY).toISOString();
const line = (productId: string, quantity: number, unitPrice: number, discountPct = 0, unit?: QuoteLineItem['unit']): QuoteLineItem =>
  ({ id: `${productId}-${quantity}`, productId, productName: productId, quantity, unitPrice, discountPct, unit });
const quote = (id: string, status: Quote['status'], extra: Partial<Quote> = {}): Quote => ({
  id, quoteNumber: `Q-2026-${id}`, accountId: 'a1', lineItems: [line('p1', 1, 1000)], status, validUntil: iso(30), createdAt: iso(-5), ...extra,
});
const settings = settingsOf([]);

describe('quote sums', () => {
  it('keeps one-time, monthly and yearly apart and counts the first year', () => {
    const s = quoteSums([line('pos', 40, 699, 10, 'Monthly'), line('pg', 1, 15000), line('cms', 1, 12000, 5, 'Monthly')], 18);
    expect(Math.round(s.byUnit['One-time'])).toBe(17700);
    expect(Math.round(s.byUnit.Monthly)).toBe(Math.round((40 * 699 * 0.9 + 12000 * 0.95) * 1.18));
    expect(Math.round(s.firstYear)).toBe(Math.round(s.byUnit['One-time'] + 12 * s.byUnit.Monthly));
    expect(Math.round(s.discount)).toBe(Math.round(40 * 699 * 0.1 + 600));
  });

  it('needs approval only above the limit, and an approval covers the same terms only', () => {
    expect(needsApproval({ lineItems: [line('p1', 1, 100, 15)] }, 15)).toBe(false);
    expect(needsApproval({ lineItems: [line('p1', 1, 100, 16)] }, 15)).toBe(true);
    expect(sameTerms([line('p1', 2, 100, 20)], [line('p1', 2, 100, 20)])).toBe(true);
    expect(sameTerms([line('p1', 2, 100, 20)], [line('p1', 2, 100, 25)])).toBe(false);
  });

  it('formats money in the bank’s currency', () => {
    expect(money(250000)).toBe('₹2,50,000');
  });
});

describe('quotes desk', () => {
  it('shows validity as days left, warns in the last week and spots quotes past their date', () => {
    expect(validityOf(quote('1', 'Sent', { sentAt: iso(-10), validUntil: iso(20) }), NOW)).toMatchObject({ kind: 'left', days: 20, tone: '' });
    expect(validityOf(quote('2', 'Sent', { sentAt: iso(-10), validUntil: iso(5) }), NOW)).toMatchObject({ kind: 'left', tone: 'soon' });
    expect(validityOf(quote('3', 'Sent', { sentAt: iso(-10), validUntil: iso(1) }), NOW).tone).toBe('late');
    expect(validityOf(quote('4', 'Sent', { validUntil: iso(-2) }), NOW).kind).toBe('lapsed');
    expect(validityOf(quote('5', 'Accepted'), NOW).kind).toBe('decided');
  });

  it('groups by who acts next: drafts newest first, sent by least time left, decided newest answer first', () => {
    const groups = quoteGroups([
      quote('a', 'Draft', { createdAt: iso(-3) }), quote('b', 'Draft', { createdAt: iso(-1) }),
      quote('c', 'Sent', { validUntil: iso(20) }), quote('d', 'Sent', { validUntil: iso(2) }),
      quote('e', 'Rejected', { decidedAt: iso(-9) }), quote('f', 'Accepted', { decidedAt: iso(-1) }),
    ]);
    expect(groups.map((g) => [g.id, g.list.map((q) => q.id)])).toEqual([['draft', ['b', 'a']], ['sent', ['d', 'c']], ['decided', ['f', 'e']]]);
  });

  it('filters by status, waiting for approval and expiring soon', () => {
    const list = [
      quote('a', 'Draft', { lineItems: [line('p1', 1, 100, 20)] }),
      quote('b', 'Draft', { lineItems: [line('p1', 1, 100, 20)], approval: 'approved' }),
      quote('c', 'Sent', { validUntil: iso(3) }), quote('d', 'Sent', { validUntil: iso(30) }),
    ];
    expect(list.filter(filterTest('approval', NOW, 15)).map((q) => q.id)).toEqual(['a']);
    expect(list.filter(filterTest('soon', NOW, 15)).map((q) => q.id)).toEqual(['c']);
    expect(list.filter(filterTest('Sent', NOW, 15)).map((q) => q.id)).toEqual(['c', 'd']);
  });

  it('totals value per status in workflow order and numbers the next quote', () => {
    const totals = statusTotals([quote('1', 'Sent'), quote('2', 'Sent'), quote('3', 'Expired')], settings);
    expect(totals.map((t) => [t.status, t.count])).toEqual([['Draft', 0], ['Sent', 2], ['Accepted', 0], ['Rejected', 0], ['Expired', 1]]);
    expect(Math.round(totals[1].value)).toBe(2360);
    expect(previewNumber([quote('0015', 'Draft'), { ...quote('x', 'Draft'), quoteNumber: 'Q-2026-482913' }], 2026)).toBe('Q-2026-0016');
  });

  it('lets the named approver or any admin decide', () => {
    expect(mayApprove({ id: 'u4', role: 'rep' }, { ...settings, approverId: 'u4' })).toBe(true);
    expect(mayApprove({ id: 'u2', role: 'rep' }, { ...settings, approverId: 'u4' })).toBe(false);
    expect(mayApprove({ id: 'u1', role: 'admin' }, settings)).toBe(true);
    expect(mayApprove({ id: 'u2', role: 'rep' }, settings)).toBe(false);
  });
});

describe('products', () => {
  it('suggests a SKU from the family and the name', () => {
    expect(skuSuggest('Payments', 'Merchant Settlement Plus')).toBe('PAY-MSP');
    expect(skuSuggest('', 'Anything')).toBe('');
  });

  it('gives the standard families their colour and a bank’s own family a steady one', () => {
    expect(familyHue('Cards')).toBe('#7a4fd6');
    expect(familyHue('Insurance')).toBe(familyHue('Insurance'));
  });

  it('counts open quotes, wins among decided quotes and the average discount', () => {
    const quotes = [
      quote('1', 'Draft', { lineItems: [line('p1', 2, 1000, 10)] }),
      quote('2', 'Accepted', { lineItems: [line('p1', 1, 1000, 20)] }),
      quote('3', 'Rejected', { lineItems: [line('p1', 1, 1000)] }),
      quote('4', 'Sent', { lineItems: [line('p2', 1, 1000)] }),
    ];
    const s = productStats({ id: 'p1' }, quotes);
    expect(s).toMatchObject({ open: 1, win: 50, avgDiscount: 10, lines: 3 });
    expect(s.value).toBe(1800 + 800 + 1000);
  });
});
