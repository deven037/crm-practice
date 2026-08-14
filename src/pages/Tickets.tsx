import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Inbox, KanbanSquare } from 'lucide-react';
import { getAll, upsert } from '../data/store';
import { Ticket, TicketPriority, TICKET_PRIORITIES } from '../types';
import { Kanban } from '../components/Kanban';
import { SplitPane } from '../components/SplitPane';
import { TicketReadingPane } from '../components/TicketReadingPane';
import { ToolBoxPanel } from '../components/ToolBoxPanel';
import { SkeletonRows } from '../components/Spinner';
import { useToast } from '../components/Toast';
import { classNames, formatDateTime, isOverdue } from '../utils';

const STATUS_FILTERS = ['All', 'Open', 'In Progress', 'Resolved', 'Closed'];

export function Tickets() {
  const navigate = useNavigate();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [statusFilter, setStatusFilter] = useState('All');
  const [mode, setMode] = useState<'inbox' | 'board'>('inbox');
  const [selectedId, setSelectedId] = useState<string | null>(null);

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

  useEffect(() => {
    if (loading) return;
    if (!visible.some((t) => t.id === selectedId)) {
      setSelectedId(visible[0]?.id ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, loading]);

  const selected = visible.find((t) => t.id === selectedId) ?? null;

  const updateTicket = (next: Ticket) => {
    setTickets((prev) => prev.map((t) => (t.id === next.id ? next : t)));
  };

  const onDropPriority = async (ticketId: string, priority: string) => {
    const ticket = tickets.find((t) => t.id === ticketId);
    if (!ticket || ticket.priority === priority) return;
    const updated = { ...ticket, priority: priority as TicketPriority };
    setTickets((prev) => prev.map((t) => (t.id === ticketId ? updated : t)));
    await upsert('tickets', updated);
    toast.push('success', `"${ticket.subject}" priority set to ${priority}.`);
  };

  return (
    <div data-testid="tickets-page">
      <div className="page-header">
        <h1>Support Tickets</h1>
        <div className="page-actions">
          <div className="view-toggle" role="group" aria-label="View mode">
            <button
              className={classNames('btn', mode === 'inbox' && 'btn-active')}
              aria-label="Inbox view"
              data-testid="view-inbox"
              onClick={() => setMode('inbox')}
            >
              <Inbox size={14} /> Inbox
            </button>
            <button
              className={classNames('btn', mode === 'board' && 'btn-active')}
              aria-label="Board view"
              data-testid="view-board"
              onClick={() => setMode('board')}
            >
              <KanbanSquare size={14} /> Board
            </button>
          </div>
          <button className="btn btn-create" onClick={() => navigate('/tickets/new')}>
            + New Ticket
          </button>
        </div>
      </div>

      <ToolBoxPanel
        module="tickets"
        links={[
          { label: 'SLA Management', to: '/setup/sla' },
          { label: 'Custom Fields', to: '/admin/objects/tickets' },
          { label: 'Customise Page Layout', to: '/setup/layouts/tickets' },
        ]}
      />

      <div className="chip-filters">
        {STATUS_FILTERS.map((s) => (
          <button key={s} className={`chip-filter${statusFilter === s ? ' active' : ''}`} onClick={() => setStatusFilter(s)}>
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <SkeletonRows rows={8} />
      ) : visible.length === 0 ? (
        <div className="empty-cell">No tickets with status “{statusFilter}”.</div>
      ) : mode === 'inbox' ? (
        <SplitPane
          testId="ticket-inbox"
          list={
            <div>
              {visible.map((ticket) => {
                const active = ticket.status === 'Open' || ticket.status === 'In Progress';
                const breached = active && isOverdue(ticket.slaDue);
                return (
                  <button
                    key={ticket.id}
                    className={classNames('split-pane-item', selectedId === ticket.id && 'active')}
                    data-testid={`ticket-inbox-row-${ticket.id}`}
                    onClick={() => setSelectedId(ticket.id)}
                  >
                    <div style={{ fontWeight: 600 }}>{ticket.subject}</div>
                    <div className="muted">{ticket.requester}</div>
                    <div className="ticket-meta" style={{ marginTop: 6, marginBottom: 0, gap: 6 }}>
                      <span className={`pill priority-${ticket.priority.toLowerCase()}`}>{ticket.priority}</span>
                      <span className={`pill ticket-${ticket.status.replace(' ', '-').toLowerCase()}`}>{ticket.status}</span>
                      {breached && <span className="pill pill-overdue">Breached</span>}
                    </div>
                    <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
                      {formatDateTime(ticket.createdAt)}
                    </div>
                  </button>
                );
              })}
            </div>
          }
          detail={
            selected ? (
              <TicketReadingPane
                testId="ticket-reading-pane"
                ticket={selected}
                onUpdate={updateTicket}
                onDeleted={() => {
                  const deletedId = selected.id;
                  setTickets((prev) => prev.filter((t) => t.id !== deletedId));
                  setSelectedId(null);
                }}
              />
            ) : (
              <div className="empty-cell">Select a ticket to view details.</div>
            )
          }
        />
      ) : (
        <Kanban
          testId="ticket-priority-board"
          emptyLabel="No tickets"
          columns={[...TICKET_PRIORITIES].reverse().map((priority) => {
            const items = visible.filter((t) => t.priority === priority);
            return { key: priority, label: priority, items, headerMeta: items.length };
          })}
          getId={(t) => t.id}
          onCardClick={(t) => navigate(`/tickets/${t.id}`)}
          onDrop={onDropPriority}
          cardRenderer={(ticket) => {
            const active = ticket.status === 'Open' || ticket.status === 'In Progress';
            const breached = active && isOverdue(ticket.slaDue);
            return (
              <>
                <div className="kanban-card-title">{ticket.subject}</div>
                <div className="kanban-card-account">{ticket.requester}</div>
                <div className="kanban-card-foot">
                  <span className={`pill ticket-${ticket.status.replace(' ', '-').toLowerCase()}`}>{ticket.status}</span>
                  {breached && <span className="pill pill-overdue">Breached</span>}
                </div>
              </>
            );
          }}
        />
      )}
    </div>
  );
}
