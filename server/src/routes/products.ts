import { Router } from 'express';
import { store, newId } from '../db.js';
import { crudRouter } from './crud.js';
import { productSchema } from '../schemas/product.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { notFound } from '../errors.js';
import { ChargeType, PricePoint, Product } from '../types.js';

/** Price points kept per product; the oldest go first. */
export const PRICE_HISTORY_LIMIT = 40;

function autoSku(name: string): string {
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 4);
  return `PRD-${initials}-${String(Date.now()).slice(-4)}`;
}

function buildProduct(body: any): Product {
  return {
    id: body.id ?? newId('product'),
    name: body.name,
    sku: body.sku?.trim() || autoSku(body.name),
    category: body.category ?? 'Accounts',
    price: body.price,
    unit: (body.unit as ChargeType | undefined) ?? 'One-time',
    description: body.description ?? '',
    active: body.active ?? true,
    layoutName: body.layoutName ?? null,
    createdAt: new Date().toISOString(),
    customFields: body.customFields,
  };
}

/** The history to keep after a save: a new point only when the price really changed. */
export function nextPriceHistory(existing: Product | undefined, price: number, by: string, at = new Date().toISOString()): PricePoint[] {
  const history = existing?.priceHistory?.length
    ? [...existing.priceHistory]
    : existing
      ? [{ price: existing.price, at: existing.createdAt, by: 'Unknown' }]
      : [];
  if (!history.length || history[history.length - 1].price !== price) history.push({ price, at, by });
  return history.slice(-PRICE_HISTORY_LIMIT);
}

export const productsRouter: Router = crudRouter<Product>({
  collection: store.products,
  entityLabel: 'Product',
  auditAction: 'product',
  createSchema: productSchema,
  buildCreate: (body, req) => {
    const product = buildProduct(body);
    return { ...product, priceHistory: [{ price: product.price, at: product.createdAt, by: req.user!.name }] };
  },
  buildUpdate: (body, id, req) => {
    const existing = store.products.get(id);
    const built = buildProduct(body);
    return {
      ...built,
      id,
      sku: existing?.sku ?? built.sku, // SKU immutable after creation, mirrors client
      layoutName: existing?.layoutName ?? null, // Layout immutable after creation, same reasoning
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      // Older products have no charge type; keep whatever was saved unless the form sends one.
      unit: (body.unit as ChargeType | undefined) ?? existing?.unit ?? 'One-time',
      priceHistory: nextPriceHistory(existing, built.price, req.user!.name),
    };
  },
});

// DELETE /api/products/:id — unlinks referencing Leads (productId -> null), leaves
// Quote line-item snapshots untouched (they fall back to their stored productName).
productsRouter.delete('/:id', requireAuth, requireRole('admin', 'rep'), (req, res) => {
  const product = store.products.get(req.params.id);
  if (!product) throw notFound('Product');

  const leads = store.leads.all().filter((l) => l.productId === product.id);
  leads.forEach((l) => store.leads.update(l.id, { productId: null }));
  const affectedQuotes = store.quotes.all().filter((q) => q.lineItems.some((li) => li.productId === product.id));

  store.products.remove(product.id);
  store.logAudit(
    req.user!.name,
    'product.delete',
    `Deleted product ${product.name} (${leads.length} lead(s) unlinked, ${affectedQuotes.length} quote(s) reference it historically)`
  );
  res.status(204).end();
});
