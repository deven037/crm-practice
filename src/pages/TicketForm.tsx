import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { newId, upsert, logAudit } from '../data/store';
import { Ticket, TicketPriority, TICKET_PRIORITIES } from '../types';
import { Select } from '../components/Select';
import { useToast } from '../components/Toast';
import { useAuth } from '../auth/AuthContext';

export function TicketForm() {
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();

  const [subject, setSubject] = useState('');
  const [requester, setRequester] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TicketPriority>('Medium');
  const [errors, setErrors] = useState<{ subject?: string; requester?: string }>({});
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const errs: typeof errors = {};
    if (!subject.trim()) errs.subject = 'Subject is required.';
    if (!requester.trim()) errs.requester = 'Requester is required.';
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

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
    setBusy(true);
    await upsert('tickets', ticket);
    logAudit(user?.name ?? 'Unknown', 'ticket.create', `Created ticket "${ticket.subject}"`);
    toast.push('success', `Ticket "${ticket.subject}" created.`);
    navigate(`/tickets/${ticket.id}`);
  };

  return (
    <div data-testid="ticket-form-page">
      <nav className="breadcrumbs">
        <Link to="/tickets">Tickets</Link> <span>/</span> <span>New ticket</span>
      </nav>
      <div className="page-header">
        <h1>New ticket</h1>
      </div>

      <div className="card form-card">
        <div className="field">
          <span className="field-label">Subject *</span>
          <input className="input" data-testid="ticket-subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
          {errors.subject && <span className="field-error">{errors.subject}</span>}
        </div>
        <div className="field">
          <span className="field-label">Requester *</span>
          <input className="input" data-testid="ticket-requester" value={requester} onChange={(e) => setRequester(e.target.value)} />
          {errors.requester && <span className="field-error">{errors.requester}</span>}
        </div>
        <div className="field">
          <span className="field-label">Priority</span>
          <Select
            value={priority}
            options={TICKET_PRIORITIES.map((p) => ({ value: p, label: p }))}
            onChange={(v) => setPriority(v as TicketPriority)}
            testId="ticket-priority-select"
          />
        </div>
        <div className="field">
          <span className="field-label">Description</span>
          <textarea
            className="input"
            rows={4}
            data-testid="ticket-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="form-actions">
          <button className="btn" onClick={() => navigate('/tickets')}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={busy} onClick={submit}>
            {busy ? 'Creating…' : 'Create ticket'}
          </button>
        </div>
      </div>
    </div>
  );
}
