import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAll } from '../data/store';
import { Ticket } from '../types';
import { SkeletonRows } from '../components/Spinner';
import { formatDateTime, isOverdue } from '../utils';

const STATUS_FILTERS = ['All', 'Open', 'In Progress', 'Resolved', 'Closed'];

export function Tickets() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [statusFilter, setStatusFilter] = useState('All');

  useEffect(() => {
    (async () => {
      setTickets(await getAll<Ticket>('tickets'));
      setLoading(false);
    })();
  }, []);

  const visible = useMemo(
    () => (statusFilter === 'All' ? tickets : tickets.filter((t) => t.status === statusFilter)),
    [tickets, statusFilter]
  );

  return (
    <div data-testid="tickets-page">
      <div className="page-header">
        <h1>Support Tickets</h1>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={() => navigate('/tickets/new')}>
            + New Ticket
          </button>
        </div>
      </div>

      <div className="chip-filters">
        {STATUS_FILTERS.map((s) => (
          <button key={s} className={`chip-filter${statusFilter === s ? ' active' : ''}`} onClick={() => setStatusFilter(s)}>
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <SkeletonRows rows={8} />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Subject</th>
                <th>Requester</th>
                <th>Priority</th>
                <th>Status</th>
                <th>SLA</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((ticket) => {
                const active = ticket.status === 'Open' || ticket.status === 'In Progress';
                const breached = active && isOverdue(ticket.slaDue);
                return (
                  <tr key={ticket.id} className="row-clickable" onClick={() => navigate(`/tickets/${ticket.id}`)}>
                    <td>{ticket.subject}</td>
                    <td>{ticket.requester}</td>
                    <td>
                      <span className={`pill priority-${ticket.priority.toLowerCase()}`}>{ticket.priority}</span>
                    </td>
                    <td>
                      <span className={`pill ticket-${ticket.status.replace(' ', '-').toLowerCase()}`}>{ticket.status}</span>
                    </td>
                    <td>{active ? (breached ? <span className="pill pill-overdue">Breached</span> : 'Within SLA') : '—'}</td>
                    <td>{formatDateTime(ticket.createdAt)}</td>
                  </tr>
                );
              })}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty-cell">
                    No tickets with status “{statusFilter}”.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

    </div>
  );
}
