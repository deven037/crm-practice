import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getById } from '../data/store';
import { Product } from '../types';
import { Spinner } from '../components/Spinner';
import { ProductForm } from './ProductForm';

/** Edit a product on the same full page as New product, filled in with what is saved. */
export function ProductEdit() {
  const { id } = useParams();
  const [product, setProduct] = useState<Product | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'failed'>('loading');

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    getById<Product>('products', id ?? '', true).then(
      (found) => {
        if (cancelled) return;
        setProduct(found ?? null);
        setState(found ? 'ready' : 'missing');
      },
      (error) => { if (!cancelled) setState((error as { status?: number }).status === 404 ? 'missing' : 'failed'); },
    );
    return () => { cancelled = true; };
  }, [id]);

  if (state === 'loading') return <Spinner label="Loading product…" />;
  if (state === 'failed') return <div className="banner banner-error" role="alert">This product couldn’t load. Check your connection and reload the page.</div>;
  if (state === 'missing' || !product) return <div className="empty-cell">Product not found. <Link to="/products">Back to products</Link></div>;
  return <ProductForm key={product.id} existing={product} />;
}
