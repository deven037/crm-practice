import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getById } from '../data/store';
import { Ticket } from '../types';
import { Spinner } from '../components/Spinner';
import { TicketForm } from './TicketForm';

/** Edit a ticket on the same full page as New ticket, filled in with what is saved. */
export function TicketEdit() {
  const { id } = useParams();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'failed'>('loading');

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    getById<Ticket>('tickets', id ?? '', true).then(
      (found) => {
        if (cancelled) return;
        setTicket(found ?? null);
        setState(found ? 'ready' : 'missing');
      },
      () => { if (!cancelled) setState('failed'); },
    );
    return () => { cancelled = true; };
  }, [id]);

  if (state === 'loading') return <Spinner label="Loading ticket…" />;
  if (state === 'failed') {
    return (
      <div className="banner banner-error" role="alert" data-testid="ticket-load-error">
        This ticket couldn’t load. Check your connection and reload the page.
      </div>
    );
  }
  if (state === 'missing' || !ticket) {
    return (
      <div className="empty-cell">
        Ticket not found. <Link to="/tickets">Back to tickets</Link>
      </div>
    );
  }
  return <TicketForm key={ticket.id} existing={ticket} />;
}
