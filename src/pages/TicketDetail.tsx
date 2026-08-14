import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getById } from '../data/store';
import { Ticket } from '../types';
import { Spinner } from '../components/Spinner';
import { TicketReadingPane } from '../components/TicketReadingPane';
import { useRecentlyViewed } from '../hooks/useRecentlyViewed';

export function TicketDetail() {
  const { id } = useParams();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [notFound, setNotFound] = useState(false);
  const navigate = useNavigate();
  const { recordView } = useRecentlyViewed();

  useEffect(() => {
    (async () => {
      const t = await getById<Ticket>('tickets', id ?? '');
      if (!t) setNotFound(true);
      else setTicket(t);
    })();
  }, [id]);

  useEffect(() => {
    if (ticket) recordView({ module: 'tickets', id: ticket.id, label: ticket.subject, link: `/tickets/${ticket.id}`, meta: { Status: ticket.status } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticket?.id]);

  if (notFound) {
    return (
      <div className="empty-cell">
        Ticket not found. <Link to="/tickets">Back to tickets</Link>
      </div>
    );
  }
  if (!ticket) return <Spinner label="Loading ticket…" />;

  return (
    <div>
      <nav className="breadcrumbs">
        <Link to="/tickets">Tickets</Link> <span>/</span> <span>{ticket.subject}</span>
      </nav>
      <TicketReadingPane
        testId="ticket-detail-page"
        ticket={ticket}
        onUpdate={setTicket}
        onDeleted={() => navigate('/tickets')}
      />
    </div>
  );
}
