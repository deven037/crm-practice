import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAll, newId, upsert } from '../data/store';
import { Ticket, TicketPriority, TICKET_PRIORITIES } from '../types';
import { Modal } from '../components/Modal';
import { Select } from '../components/Select';
import { SkeletonRows } from '../components/Spinner';
import { useToast } from '../components/Toast';
import { formatDateTime, isOverdue } from '../utils';

const STATUS_FILTERS = ['All', 'Open', 'In Progress', 'Resolved', 'Closed'];

export function Tickets() {
  const navigate = useNavigate();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [statusFilter, setStatusFilter] = useState('All');
  const [creating, setCreating] = useState(false);
  const [subject, setSubject] = useState('');
  const [requester, setRequester] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TicketPriority>('Medium');

  const load = async () => {
    setTickets(await getAll<Ticket>('tickets'));
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const visible = useMemo(
    () => (statusFilter === 'All' ? tickets : tickets.filter((t) => t.status === statusFilter)),
    [tickets, statusFilter]
  );

  const createTicket = async () => {
    if (!subject.trim() || !requester.trim()) {
      toast.push('error', 'Subject and requester are required.');
      return;
    }
    const ticket: Ticket = {
      id: newId('ticket'),
      subject: subject.trim(),
      description: description.trim(),
      requester: requester.trim(),
      priority,
      status: 'Open',
      slaDue: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
      comments: [],
      attachments: [],
    };
    await upsert('tickets', ticket);
    toast.push('success', `Ticket "${ticket.subject}" created.`);
    setCreating(false);
    setSubject('');
    setRequester('');
    setDescription('');
    setPriority('Medium');
    load();
  };

  return (
    <div data-testid="tickets-page">
      <div className="page-header">
        <h1>Support Tickets</h1>
        <div className="page-actions">
          <button className="btn btn-primary" data-testid="add-ticket-btn" onClick={() => setCreating(true)}>
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

      {creating && (
        <Modal
          title="New ticket"
          onClose={() => setCreating(false)}
          footer={
            <>
              <button className="btn" onClick={() => setCreating(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" data-testid="ticket-create-btn" onClick={createTicket}>
                Create ticket
              </button>
            </>
          }
        >
          <div className="field">
            <span className="field-label">Subject *</span>
            <input className="input" data-testid="ticket-subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div className="field">
            <span className="field-label">Requester *</span>
            <input className="input" data-testid="ticket-requester" value={requester} onChange={(e) => setRequester(e.target.value)} />
          </div>
          <div className="field">
            <span className="field-label">Priority</span>
            <Select
              value={priority}
              options={TICKET_PRIORITIES.map((p) => ({ value: p, label: p }))}
              onChange={(v) => setPriority(v as TicketPriority)}
            />
          </div>
          <div className="field">
            <span className="field-label">Description</span>
            <textarea className="input" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </Modal>
      )}
    </div>
  );
}
