import { ChangeEvent, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getById, newId, upsert } from '../data/store';
import { Ticket, TicketPriority, TicketStatus, TICKET_PRIORITIES, TICKET_TRANSITIONS } from '../types';
import { Select } from '../components/Select';
import { Spinner } from '../components/Spinner';
import { useToast } from '../components/Toast';
import { useAuth } from '../auth/AuthContext';
import { formatDateTime } from '../utils';

const CANNED_RESPONSES = [
  { value: '', label: 'Insert canned response…' },
  { value: 'Thanks for reaching out! We are looking into this and will get back to you shortly.', label: 'Acknowledgement' },
  { value: 'Could you share a screenshot and the steps to reproduce the issue?', label: 'Request more info' },
  { value: 'This has been fixed in the latest release. Please refresh and try again.', label: 'Fixed in release' },
  { value: 'We are escalating this to our engineering team as a priority.', label: 'Escalation' },
];

/** Live SLA countdown — DOM text changes every second; practices handling dynamic content. */
function SlaCountdown({ due, active }: { due: string; active: boolean }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);

  if (!active) return <span className="muted">SLA not applicable (ticket {`isn't`} active)</span>;

  const diff = new Date(due).getTime() - now;
  if (diff <= 0) return <span className="pill pill-overdue">SLA breached</span>;
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  return (
    <span className="sla-countdown" data-testid="sla-countdown">
      ⏱ SLA due in {hours}h {String(minutes).padStart(2, '0')}m {String(seconds).padStart(2, '0')}s
    </span>
  );
}

export function TicketDetail() {
  const { id } = useParams();
  const toast = useToast();
  const { user } = useAuth();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [comment, setComment] = useState('');
  const [editingComment, setEditingComment] = useState<{ id: string; text: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      const t = await getById<Ticket>('tickets', id ?? '');
      if (!t) setNotFound(true);
      else setTicket(t);
    })();
  }, [id]);

  if (notFound) {
    return (
      <div className="empty-cell">
        Ticket not found. <Link to="/tickets">Back to tickets</Link>
      </div>
    );
  }
  if (!ticket) return <Spinner label="Loading ticket…" />;

  const persist = async (next: Ticket, message?: string) => {
    await upsert('tickets', next);
    setTicket(next);
    if (message) toast.push('success', message);
  };

  const transition = (status: TicketStatus) => persist({ ...ticket, status }, `Ticket moved to ${status}.`);

  const addComment = () => {
    if (!comment.trim()) return;
    persist(
      {
        ...ticket,
        comments: [
          ...ticket.comments,
          { id: newId('tcomment'), author: user?.name ?? 'Unknown', text: comment.trim(), createdAt: new Date().toISOString() },
        ],
      },
      'Comment added.'
    );
    setComment('');
  };

  const saveEditedComment = () => {
    if (!editingComment) return;
    persist(
      {
        ...ticket,
        comments: ticket.comments.map((c) => (c.id === editingComment.id ? { ...c, text: editingComment.text } : c)),
      },
      'Comment updated.'
    );
    setEditingComment(null);
  };

  const deleteComment = (commentId: string) => {
    if (!window.confirm('Delete this comment?')) return;
    persist({ ...ticket, comments: ticket.comments.filter((c) => c.id !== commentId) }, 'Comment deleted.');
  };

  const onAttach = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    persist(
      { ...ticket, attachments: [...ticket.attachments, { id: newId('file'), name: file.name, size: file.size }] },
      `Attachment "${file.name}" added.`
    );
    e.target.value = '';
  };

  const active = ticket.status === 'Open' || ticket.status === 'In Progress';

  return (
    <div data-testid="ticket-detail-page">
      <nav className="breadcrumbs">
        <Link to="/tickets">Tickets</Link> <span>/</span> <span>{ticket.subject}</span>
      </nav>

      <div className="page-header">
        <h1>{ticket.subject}</h1>
        <span className={`pill ticket-${ticket.status.replace(' ', '-').toLowerCase()}`} data-testid="ticket-status">
          {ticket.status}
        </span>
      </div>

      <div className="card">
        <div className="ticket-meta">
          <span>
            Requester: <strong>{ticket.requester}</strong>
          </span>
          <span className="field" style={{ minWidth: 160 }}>
            <Select
              value={ticket.priority}
              options={TICKET_PRIORITIES.map((p) => ({ value: p, label: p }))}
              onChange={(v) => persist({ ...ticket, priority: v as TicketPriority }, `Priority set to ${v}.`)}
              testId="ticket-priority"
            />
          </span>
          <SlaCountdown due={ticket.slaDue} active={active} />
        </div>
        <p>{ticket.description}</p>

        <div className="transition-row">
          <span className="muted">Move to:</span>
          {TICKET_TRANSITIONS[ticket.status].map((next) => (
            <button key={next} className="btn" onClick={() => transition(next)}>
              {next}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <h3>Attachments ({ticket.attachments.length})</h3>
        <button className="btn" data-testid="ticket-attach-btn" onClick={() => fileInput.current?.click()}>
          📎 Add attachment
        </button>
        <input ref={fileInput} type="file" hidden data-testid="ticket-file-input" onChange={onAttach} />
        <ul className="file-list">
          {ticket.attachments.map((f) => (
            <li key={f.id}>
              📄 {f.name} <span className="muted">({Math.max(1, Math.round(f.size / 1024))} KB)</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="card">
        <h3>Comments ({ticket.comments.length})</h3>
        <div className="comment-thread">
          {ticket.comments.map((c) => (
            <div key={c.id} className="comment">
              <div className="comment-head">
                <strong>{c.author}</strong>
                <span className="muted">{formatDateTime(c.createdAt)}</span>
              </div>
              {editingComment?.id === c.id ? (
                <div className="note-composer">
                  <textarea
                    className="input"
                    rows={2}
                    value={editingComment.text}
                    onChange={(e) => setEditingComment({ ...editingComment, text: e.target.value })}
                  />
                  <button className="btn btn-primary btn-small" onClick={saveEditedComment}>
                    Save
                  </button>
                  <button className="btn btn-small" onClick={() => setEditingComment(null)}>
                    Cancel
                  </button>
                </div>
              ) : (
                <p>{c.text}</p>
              )}
              {c.author === user?.name && editingComment?.id !== c.id && (
                <div className="comment-actions">
                  <button className="link-btn" onClick={() => setEditingComment({ id: c.id, text: c.text })}>
                    Edit
                  </button>
                  <button className="link-btn" onClick={() => deleteComment(c.id)}>
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="comment-composer">
          <Select value="" options={CANNED_RESPONSES} onChange={(v) => v && setComment(v)} testId="canned-response" />
          <textarea
            className="input"
            rows={3}
            placeholder="Write a comment…"
            data-testid="comment-input"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
          <button className="btn btn-primary" data-testid="add-comment-btn" onClick={addComment}>
            Add comment
          </button>
        </div>
      </div>
    </div>
  );
}
