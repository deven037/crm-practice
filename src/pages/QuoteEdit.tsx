import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getById } from '../data/store';
import { Quote } from '../types';
import { Spinner } from '../components/Spinner';
import { QuoteForm } from './QuoteForm';

/** Edit a quote in the quote builder, filled in with what is saved. Accepted quotes can't change. */
export function QuoteEdit() {
  const { id } = useParams();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'failed'>('loading');

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    getById<Quote>('quotes', id ?? '', true).then(
      (found) => {
        if (cancelled) return;
        setQuote(found ?? null);
        setState(found ? 'ready' : 'missing');
      },
      (error) => { if (!cancelled) setState((error as { status?: number }).status === 404 ? 'missing' : 'failed'); },
    );
    return () => { cancelled = true; };
  }, [id]);

  if (state === 'loading') return <Spinner label="Loading quote…" />;
  if (state === 'failed') return <div className="banner banner-error" role="alert">This quote couldn’t load. Check your connection and reload the page.</div>;
  if (state === 'missing' || !quote) return <div className="empty-cell">Quote not found. <Link to="/quotes">Back to quotes</Link></div>;
  if (quote.status === 'Accepted') {
    return <div className="empty-cell">{quote.quoteNumber} is accepted and can’t change. <Link to={`/quotes/new?from=${quote.id}`}>Duplicate it</Link> to quote again.</div>;
  }
  return <QuoteForm key={quote.id} existing={quote} />;
}
