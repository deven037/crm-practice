import { Router } from 'express';
import { store, newId } from '../db.js';
import { crudRouter } from './crud.js';
import { productSchema } from '../schemas/product.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { notFound } from '../errors.js';
import { Product } from '../types.js';

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
    category: body.category ?? 'Subscription',
    price: body.price,
    description: body.description ?? '',
    active: body.active ?? true,
    createdAt: new Date().toISOString(),
    customFields: body.customFields,
  };
}

export const productsRouter: Router = crudRouter<Product>({
  collection: store.products,
  entityLabel: 'Product',
  auditAction: 'product',
  createSchema: productSchema,
  buildCreate: (body) => buildProduct(body),
  buildUpdate: (body, id) => {
    const existing = store.products.get(id);
    return {
      ...buildProduct(body),
      id,
      sku: existing?.sku ?? buildProduct(body).sku, // SKU immutable after creation, mirrors client
      createdAt: existing?.createdAt ?? new Date().toISOString(),
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
