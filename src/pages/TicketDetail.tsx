import { CSSProperties, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowUp, Check, ChevronLeft, Clock, Lock, MessageCircle, Paperclip, Pencil, RotateCcw, Send, Trash2 } from 'lucide-react';
import { getAll, getAllSync, getById, removeMany } from '../data/store';
import { apiFetch } from '../data/apiFetch';
import { Account, Contact, Ticket, TicketPriority, TicketStatus, User } from '../types';
import { Modal } from '../components/Modal';
import { Spinner } from '../components/Spinner';
import { CustomFieldsSection } from '../components/CustomFieldsSection';
import { useToast } from '../components/Toast';
import { useAuth } from '../auth/AuthContext';
import { useRecentlyViewed } from '../hooks/useRecentlyViewed';
import { classNames } from '../utils';
import { SearchPicker } from './deals/dealBits';
import {
  cannedLabel, cannedReplies, canWriteTickets, fillCanned, hoursText, isOpenTicket, leftMs, nextStatuses, PRIORITY_ORDER, priorityHue,
  slaConfigsNow, slaRulesNow, spanText, staffOf, statusHue, threadOf, ThreadItem, ticketRef, whenText,
} from './tickets/ticketLogic';
import { policyFor } from './tickets/slaMath';
import { ChannelMark, LiveTimer, PriorityMark, StatusPill, TimeTrack, UserFace } from './tickets/ticketBits';

const post = <T,>(path: string, body: unknown) => apiFetch<T>(path, { method: 'POST', body: JSON.stringify(body) });

/**
 * The ticket room: a live SLA timer and time track, the conversation with internal notes, and the
 * handling cards (status, priority, owner), customer and details beside it.
 */
export function TicketDetail() {
  const { id } = useParams();
  const toast = useToast();
  // The order of these states is relied on by the page tests; add new ones at the end.
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [others, setOthers] = useState<Ticket[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [escalating, setEscalating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [stamped, setStamped] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();
  const canWrite = canWriteTickets(user?.role);
  const { recordView, removeViews } = useRecentlyViewed();

  useEffect(() => {
    (async () => {
      try {
        const [t, all, people] = await Promise.all([
          getById<Ticket>('tickets', id ?? '', true).catch((e) => { if ((e as { status?: number })?.status === 404) return undefined; throw e; }),
          getAll<Ticket>('tickets').catch((): Ticket[] => []),
          getAll<User>('users').catch((): User[] => []),
        ]);
        if (!t) {
          setNotFound(true);
          removeViews([id ?? '']);
          return;
        }
        setNotFound(false);
        setLoadError(false);
        setTicket(t);
        setUsers([...people]);
        setOthers(all.filter((x) => x.id !== t.id && ((t.contactId && x.contactId === t.contactId) || x.requester === t.requester)));
      } catch {
        setLoadError(true);
      }
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
  if (loadError) {
    return (
      <div className="banner banner-error" role="alert" data-testid="ticket-load-error">
        This ticket couldn’t load. Check your connection and reload the page.
      </div>
    );
  }
  if (!ticket || ticket.id !== id) return <Spinner label="Loading ticket…" />;

  const rules = slaRulesNow();
  const policy = policyFor(ticket.priority, slaConfigsNow());
  const open = isOpenTicket(ticket);
  const owner = users.find((u) => u.id === ticket.ownerId);
  const contact = getAllSync<Contact>('contacts').find((c) => c.id === ticket.contactId);
  const account = getAllSync<Account>('accounts').find((a) => a.id === (ticket.accountId ?? contact?.accountId));
  const thread = threadOf(ticket);
  const messages = thread.filter((m) => m.kind !== 'system').length;
  const frDue = ticket.firstReplyDue ? Date.parse(ticket.firstReplyDue) : NaN;
  const frAt = ticket.firstReplyAt ? Date.parse(ticket.firstReplyAt) : NaN;
  const allowed = nextStatuses(ticket.status);

  const apply = async (call: () => Promise<Ticket>, message: string | ((t: Ticket) => string)) => {
    setBusy(true);
    try {
      const saved = await call();
      setTicket(saved);
      toast.push('success', typeof message === 'function' ? message(saved) : message);
      setBusy(false);
      return saved;
    } catch (e) {
      toast.push('error', (e as Error)?.message || 'That didn’t save. Check your connection and try again.');
      setBusy(false);
      return null;
    }
  };

  const moveTo = (status: string) => {
    if (status === ticket.status) return;
    if (status === 'Resolved') { setResolving(true); return; }
    apply(() => post<Ticket>(`/tickets/${ticket.id}/transition`, { status }), rules.pauseStatuses.includes(status as TicketStatus) ? 'SLA paused while waiting on the customer.' : `Status set to ${status}.`);
  };

  const confirmDelete = async () => {
    setDeleteBusy(true);
    try {
      await removeMany('tickets', [ticket.id]);
    } catch {
      setDeleteBusy(false);
      toast.push('error', 'The ticket couldn’t be deleted. Check your connection and try again.');
      return;
    }
    removeViews([ticket.id]);
    toast.push('success', 'Ticket deleted.');
    navigate('/tickets');
  };

  return (
    <div className="tk3 tk-room" data-testid="ticket-detail-page">
      <Link to="/tickets" className="contact-back"><ChevronLeft size={16} aria-hidden="true" /> Tickets</Link>
      <div className="tk-head">
        <div className="tk-head-t">
          <div className="tk-eyebrow">{ticketRef(ticket)}{ticket.category ? ` · ${ticket.category}` : ''}</div>
          <h1>{ticket.subject}</h1>
          <div className="tk-meta">
            <StatusPill status={ticket.status} />
            <PriorityMark priority={ticket.priority} />
            <ChannelMark channel={ticket.channel} />
            {(ticket.escalation ?? 0) > 0 && open && <span className="tk-esc"><ArrowUp size={11} aria-hidden="true" />Escalated level {ticket.escalation}</span>}
          </div>
        </div>
        {canWrite && (
          <div className="tk-acts">
            <Link className="btn" to={`/tickets/${ticket.id}/edit`} data-testid="edit-ticket-btn"><Pencil size={15} aria-hidden="true" /> Edit</Link>
            {open ? (
              <>
                <button type="button" className="btn" disabled={busy} onClick={() => setEscalating(true)} data-testid="escalate-ticket-btn"><ArrowUp size={15} aria-hidden="true" /> Escalate</button>
                <button type="button" className="btn btn-primary contacts-primary" disabled={busy || !allowed.includes('Resolved')} title={allowed.includes('Resolved') ? undefined : `Move it to Open or In Progress first`} onClick={() => setResolving(true)} data-testid="resolve-ticket-btn"><Check size={15} aria-hidden="true" /> Resolve</button>
              </>
            ) : (
              <button type="button" className="btn" disabled={busy} data-testid="reopen-ticket-btn" onClick={() => { setStamped(false); apply(() => post<Ticket>(`/tickets/${ticket.id}/transition`, { status: ticket.status === 'Closed' ? 'Open' : 'In Progress' }), 'Reopened. The SLA clock carries on from where it stopped.'); }}>
                <RotateCcw size={15} aria-hidden="true" /> Reopen
              </button>
            )}
            <button
              type="button"
              className={classNames('btn tk-sq', ticket.status === 'Closed' && 'btn-danger-ghost')}
              data-testid="delete-ticket-btn"
              disabled={ticket.status !== 'Closed'}
              title={ticket.status === 'Closed' ? 'Delete ticket' : 'Only closed tickets can be deleted'}
              aria-label={ticket.status === 'Closed' ? 'Delete ticket' : 'Delete ticket (only closed tickets can be deleted)'}
              onClick={() => setDeleting(true)}
            >
              <Trash2 size={16} aria-hidden="true" />
            </button>
          </div>
        )}
      </div>

      <section className="tk-card tk-trackc" aria-label="SLA">
        {stamped && !open && <ResolvedStamp ticket={ticket} />}
        <div className="tk-trk-top">
          <LiveTimer ticket={ticket} warnPercent={rules.warnPercent} />
          <span className="tk-spacer" />
          <div className="tk-goal">
            <MessageCircle size={14} aria-hidden="true" />First reply{' '}
            {Number.isFinite(frAt) ? (
              <b className={Number.isFinite(frDue) && frAt > frDue ? 'bad' : 'ok'}>{Number.isFinite(frDue) && frAt > frDue ? 'late' : 'met'} in {spanText(frAt - Date.parse(ticket.createdAt))}</b>
            ) : Number.isFinite(frDue) ? (
              <b className={Date.now() > frDue ? 'bad' : undefined}>due {whenText(frDue)}</b>
            ) : (
              <b>—</b>
            )}
            <span className="tk-muted">target {hoursText(policy.firstReplyMinutes / 60)}</span>
          </div>
          <div className="tk-goal"><Clock size={14} aria-hidden="true" />Resolve <b>target {hoursText(policy.resolveMinutes / 60)}</b><span className="tk-muted">{policy.clock === '24x7' ? 'round the clock' : 'working hours'}</span></div>
        </div>
        <TimeTrack ticket={ticket} warnPercent={rules.warnPercent} />
      </section>

      <div className="tk-cols">
        <section className="tk-card tk-convo" aria-label="Conversation">
          <div className="tk-convo-h"><h2>Conversation</h2><span className="tk-muted">{messages} {messages === 1 ? 'message' : 'messages'}</span></div>
          <Thread items={thread} users={users} requester={ticket.requester} />
          {canWrite && <Composer ticket={ticket} pauseStatuses={rules.pauseStatuses} onSent={setTicket} />}
        </section>

        <div className="tk-side">
          <section className="tk-card tk-box" aria-label="Handling">
            <h2>Handling</h2>
            <div className="tk-sgrid">
              <div>
                <span className="tk-slab">Status</span>
                {canWrite ? (
                  <SearchPicker
                    label="Status"
                    find="Find a status"
                    testId="ticket-status-picker"
                    value={ticket.status}
                    options={[ticket.status, ...allowed].map((s) => ({ value: s, label: s, hue: statusHue(s), hint: s === ticket.status ? 'now' : rules.pauseStatuses.includes(s) ? 'pauses SLA' : undefined }))}
                    footer={`Only the moves the workflow allows from ${ticket.status} are listed.`}
                    onPick={moveTo}
                  />
                ) : <StatusPill status={ticket.status} />}
              </div>
              <div>
                <span className="tk-slab">Priority</span>
                {canWrite ? (
                  <SearchPicker
                    label="Priority"
                    find="Find a priority"
                    testId="ticket-priority-picker"
                    value={ticket.priority}
                    options={PRIORITY_ORDER.map((p) => ({ value: p, label: p, hue: priorityHue(p), hint: `fix in ${hoursText(policyFor(p, slaConfigsNow()).resolveMinutes / 60)}` }))}
                    onPick={(p) => {
                      if (p === ticket.priority) return;
                      apply(() => post<Ticket>(`/tickets/${ticket.id}/priority`, { priority: p as TicketPriority }), (t) => `Priority ${p}. Resolve by ${whenText(t.slaDue)}.`);
                    }}
                  />
                ) : <PriorityMark priority={ticket.priority} />}
              </div>
              <div>
                <span className="tk-slab">Owner</span>
                {canWrite ? (
                  <SearchPicker
                    label="Owner"
                    find="Find a person"
                    testId="ticket-owner-picker"
                    value={ticket.ownerId ?? ''}
                    options={[{ value: '', label: 'Unassigned' }, ...staffOf(users).map((u) => ({ value: u.id, label: u.name, lead: <UserFace user={u} /> }))]}
                    onPick={(v) => {
                      if (v === (ticket.ownerId ?? '')) return;
                      apply(() => post<Ticket>(`/tickets/${ticket.id}/assign`, { ownerId: v || null }), v ? `Assigned to ${users.find((u) => u.id === v)?.name ?? 'them'}.` : 'Back in the unassigned queue.');
                    }}
                  />
                ) : owner ? <span className="tk-owner"><UserFace user={owner} />{owner.name}</span> : <span className="tk-muted">Unassigned</span>}
              </div>
            </div>
          </section>

          <section className="tk-card tk-box" aria-label="Customer">
            <h2>Customer</h2>
            <div className="tk-cust">
              <i className="tk-cav">{ticket.requester.split(' ').filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase()}</i>
              <div>
                {contact ? <Link to={`/contacts/${contact.id}`} className="tk-link">{contact.name}</Link> : <b>{ticket.requester}</b>}
                <span className="tk-muted">{account ? <Link to={`/accounts/${account.id}`} className="tk-link-soft">{account.name}</Link> : 'Individual customer'}</span>
              </div>
            </div>
            {others.length > 0 && (
              <div className="tk-minis">
                <span className="tk-slab">Other tickets from {ticket.requester.split(' ')[0]}</span>
                {others.slice(0, 4).map((o) => (
                  <Link key={o.id} to={`/tickets/${o.id}`} className="tk-mini"><span>{ticketRef(o)} {o.subject}</span><StatusPill status={o.status} /></Link>
                ))}
              </div>
            )}
          </section>

          <section className="tk-card tk-box" aria-label="Details">
            <h2>Details</h2>
            <dl className="tk-kv">
              <div><dt>Category</dt><dd>{ticket.category || '—'}</dd></div>
              <div><dt>Channel</dt><dd>{ticket.channel ? <ChannelMark channel={ticket.channel} /> : '—'}</dd></div>
              <div><dt>Created</dt><dd>{whenText(ticket.createdAt)}</dd></div>
              <div><dt>SLA</dt><dd>{ticket.priority} · {policy.clock === '24x7' ? 'round the clock' : 'working hours'}</dd></div>
              {ticket.layoutName && <div><dt>Layout</dt><dd>{ticket.layoutName}</dd></div>}
            </dl>
            {ticket.attachments.length > 0 && (
              <div className="tk-files">{ticket.attachments.map((f) => <span key={f.id} className="tk-att"><Paperclip size={13} aria-hidden="true" />{f.name}</span>)}</div>
            )}
            <CustomFieldsSection module="tickets" target="detail" mode="view" values={ticket.customFields ?? {}} onChange={() => {}} />
          </section>
        </div>
      </div>

      {resolving && (
        <ResolveDialog
          ticket={ticket}
          onCancel={() => setResolving(false)}
          onDone={(saved) => { setResolving(false); setTicket(saved); setStamped(true); }}
        />
      )}
      {escalating && <EscalateDialog ticket={ticket} users={users} onCancel={() => setEscalating(false)} onDone={(saved) => { setEscalating(false); setTicket(saved); }} />}
      {deleting && (
        <Modal
          title={`Delete ${ticketRef(ticket)}?`}
          onClose={() => setDeleting(false)}
          footer={
            <>
              <button type="button" className="btn" onClick={() => setDeleting(false)}>Cancel</button>
              <button type="button" className="btn btn-danger" data-testid="confirm-delete-btn" disabled={deleteBusy} onClick={confirmDelete}>
                <Trash2 size={15} aria-hidden="true" /> {deleteBusy ? 'Deleting…' : 'Delete'}
              </button>
            </>
          }
        >
          <p>“{ticket.subject}” and its conversation are removed for good.</p>
        </Modal>
      )}
    </div>
  );
}

function Thread({ items, users, requester }: { items: ThreadItem[]; users: User[]; requester: string }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (box.current) box.current.scrollTop = box.current.scrollHeight;
  }, [items.length]);
  return (
    <div className="tk-thread" ref={box} data-testid="ticket-thread">
      {items.length === 0 && <div className="tk-muted tk-thread-empty">Nothing written yet.</div>}
      {items.map((m) => {
        if (m.kind === 'system') {
          return <div key={m.id} className="tk-sysl"><Clock size={12} aria-hidden="true" />{m.text} · {whenText(m.at, Date.now(), true)}</div>;
        }
        const mine = m.kind !== 'customer';
        const person = users.find((u) => u.id === m.byId) ?? (mine ? { id: m.by, name: m.by } : null);
        return (
          <div key={m.id} className={classNames('tk-msg', m.kind)} data-testid={`thread-${m.kind}`}>
            {mine && person ? <UserFace user={person} /> : <i className="tk-cav sm">{requester.split(' ').filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase()}</i>}
            <div className="tk-bub">
              <div className="tk-by"><b>{m.by}</b>{m.kind === 'note' && <><Lock size={11} aria-hidden="true" /> internal note</>}<span>{whenText(m.at, Date.now(), true)}</span></div>
              {m.text}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Reply to the customer or add an internal note; a reply can also put the ticket on hold. */
function Composer({ ticket, pauseStatuses, onSent }: { ticket: Ticket; pauseStatuses: TicketStatus[]; onSent: (t: Ticket) => void }) {
  const toast = useToast();
  const [mode, setMode] = useState<'reply' | 'note'>('reply');
  const [text, setText] = useState('');
  const [wait, setWait] = useState(false);
  const [busy, setBusy] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  const holdStatus = pauseStatuses.find((s) => nextStatuses(ticket.status === 'New' ? 'Open' : ticket.status).includes(s));
  const canned = cannedReplies();

  const send = async () => {
    const body = text.trim();
    if (!body) { area.current?.focus(); toast.push('error', 'Write something first.'); return; }
    setBusy(true);
    const firstReply = mode === 'reply' && !ticket.firstReplyAt;
    try {
      const saved = await post<Ticket>(`/tickets/${ticket.id}/comments`, { text: body, kind: mode, ...(mode === 'reply' && wait && holdStatus ? { thenStatus: holdStatus } : {}) });
      onSent(saved);
      setText('');
      setWait(false);
      const due = ticket.firstReplyDue ? Date.parse(ticket.firstReplyDue) : NaN;
      const late = firstReply && Number.isFinite(due) && Date.parse(saved.firstReplyAt ?? '') > due;
      toast.push('success', firstReply ? (late ? 'First reply sent, after its SLA.' : 'First reply sent, inside the SLA.') : mode === 'note' ? 'Note added.' : `Reply sent${wait && holdStatus ? ' · clock paused' : ''}.`);
    } catch (e) {
      toast.push('error', (e as Error)?.message || 'That didn’t send. Check your connection and try again.');
    }
    setBusy(false);
  };

  return (
    <div className={classNames('tk-composer', mode)}>
      <div className="tk-crow">
        <div className="tk-seg" role="group" aria-label="Message type">
          <button type="button" aria-pressed={mode === 'reply'} onClick={() => setMode('reply')}><Send size={13} aria-hidden="true" /> Reply to customer</button>
          <button type="button" aria-pressed={mode === 'note'} onClick={() => setMode('note')} data-testid="composer-note"><Lock size={13} aria-hidden="true" /> Internal note</button>
        </div>
        <span className="tk-spacer" />
        {mode === 'reply' && canned.length > 0 && (
          <div className="tk-canned">
            <SearchPicker
              label="Canned reply"
              find="Find a reply"
              value=""
              testId="canned-picker"
              options={[{ value: '', label: 'Canned reply…' }, ...canned.map((c, i) => ({ value: String(i), label: cannedLabel(c) }))]}
              onPick={(v) => { if (v === '') return; setText(fillCanned(canned[Number(v)] ?? '', ticket.requester)); area.current?.focus(); }}
            />
          </div>
        )}
      </div>
      <textarea
        ref={area}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) send(); }}
        placeholder={mode === 'reply' ? `Write to ${ticket.requester.split(' ')[0]}…` : 'Only your team sees this note'}
        aria-label={mode === 'reply' ? 'Reply to the customer' : 'Internal note'}
        data-testid="ticket-comment-input"
      />
      <div className="tk-crow">
        {mode === 'reply' && isOpenTicket(ticket) && holdStatus && !ticket.pausedAt && (
          <label className="tk-tickbox"><input type="checkbox" checked={wait} onChange={(e) => setWait(e.target.checked)} />Then set to {holdStatus} (pauses SLA)</label>
        )}
        <span className="tk-spacer" />
        <button type="button" className="btn btn-primary contacts-primary" disabled={busy} onClick={send} data-testid="add-comment-btn">
          <Send size={15} aria-hidden="true" /> {mode === 'reply' ? 'Send reply' : 'Add note'}
        </button>
      </div>
    </div>
  );
}

function ResolvedStamp({ ticket }: { ticket: Ticket }) {
  const left = leftMs(ticket, Date.now());
  const ok = left >= 0;
  return (
    <div className="tk-stamp" style={{ '--c': ok ? '#1f9d63' : '#d33a3a' } as CSSProperties} role="status">
      {ok ? 'Resolved in time' : 'Resolved late'}
      <small>{ok ? `${spanText(left)} to spare` : `${spanText(-left)} over`}</small>
    </div>
  );
}

function ResolveDialog({ ticket, onCancel, onDone }: { ticket: Ticket; onCancel: () => void; onDone: (t: Ticket) => void }) {
  const toast = useToast();
  const [note, setNote] = useState('');
  const [send, setSend] = useState(true);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const left = leftMs(ticket, Date.now());
  const submit = async () => {
    if (!note.trim()) { setError(true); return; }
    setBusy(true);
    try {
      let saved: Ticket;
      if (send) saved = await post<Ticket>(`/tickets/${ticket.id}/transition`, { status: 'Resolved', note: note.trim() });
      else {
        await post<Ticket>(`/tickets/${ticket.id}/comments`, { text: `Resolution: ${note.trim()}`, kind: 'note' });
        saved = await post<Ticket>(`/tickets/${ticket.id}/transition`, { status: 'Resolved' });
      }
      toast.push('success', leftMs(saved, Date.now()) >= 0 ? 'Resolved inside the SLA.' : 'Resolved. It counts as missed.');
      onDone(saved);
    } catch (e) {
      setBusy(false);
      toast.push('error', (e as Error)?.message || 'The ticket couldn’t be resolved. Try again.');
    }
  };
  return (
    <Modal
      title={`Resolve ${ticketRef(ticket)}`}
      onClose={onCancel}
      footer={
        <>
          <button type="button" className="btn" onClick={onCancel}>Cancel</button>
          <button type="button" className="btn btn-primary contacts-primary" disabled={busy} onClick={submit} data-testid="confirm-resolve-btn"><Check size={15} aria-hidden="true" /> Resolve</button>
        </>
      }
    >
      <p className="tk-dlg-lead">
        {left >= 0 ? <>You are inside the SLA with <b className="tk-okc">{spanText(left)}</b> to spare.</> : <>This ticket is <b className="tk-badc">{spanText(-left)}</b> over its SLA. It will count as missed.</>}
      </p>
      <label className="tk-flabel" htmlFor="resolve-note">Resolution note <span className="tk-muted">required</span></label>
      <textarea id="resolve-note" className={classNames('tk-ta', error && 'bad')} value={note} autoFocus aria-invalid={error || undefined}
        onChange={(e) => { setNote(e.target.value); setError(false); }} placeholder={send ? 'What fixed it. The customer sees this.' : 'What fixed it. Only your team sees this.'} data-testid="resolve-note" />
      {error && <div className="tk-err">Write what fixed it.</div>}
      <label className="tk-tickbox tk-gap"><input type="checkbox" checked={send} onChange={(e) => setSend(e.target.checked)} />Send the note to {ticket.requester.split(' ')[0]} as a reply</label>
    </Modal>
  );
}

function EscalateDialog({ ticket, users, onCancel, onDone }: { ticket: Ticket; users: User[]; onCancel: () => void; onDone: (t: Ticket) => void }) {
  const toast = useToast();
  const rules = slaRulesNow();
  const [level, setLevel] = useState(Math.min(3, (ticket.escalation ?? 0) + 1));
  const [reason, setReason] = useState('');
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const name = (uid: string | null, fallback: string) => users.find((u) => u.id === uid)?.name ?? fallback;
  const levels = [
    { n: 1, who: name(rules.level1UserId, 'Team lead'), role: 'Level 1 · team lead' },
    { n: 2, who: name(rules.level2UserId, 'Service manager'), role: 'Level 2 · service manager' },
    { n: 3, who: 'Senior management', role: 'Level 3 · outside the CRM, by email' },
  ];
  const submit = async () => {
    if (!reason.trim()) { setError(true); return; }
    setBusy(true);
    try {
      const saved = await post<Ticket>(`/tickets/${ticket.id}/escalate`, { level, reason: reason.trim() });
      toast.push('success', `Escalated to level ${level}.`);
      onDone(saved);
    } catch (e) {
      setBusy(false);
      toast.push('error', (e as Error)?.message || 'The ticket couldn’t be escalated. Try again.');
    }
  };
  return (
    <Modal
      title={`Escalate ${ticketRef(ticket)}`}
      onClose={onCancel}
      footer={
        <>
          <button type="button" className="btn" onClick={onCancel}>Cancel</button>
          <button type="button" className="btn btn-primary contacts-primary" disabled={busy} onClick={submit} data-testid="confirm-escalate-btn"><ArrowUp size={15} aria-hidden="true" /> Escalate</button>
        </>
      }
    >
      <div className="tk-lvls" role="radiogroup" aria-label="Escalation level">
        {levels.map((l) => (
          <button key={l.n} type="button" role="radio" aria-checked={level === l.n} className="tk-lvl" onClick={() => setLevel(l.n)}>
            <span className="tk-lvl-n">L{l.n}</span><span><b>{l.who}</b><small>{l.role}</small></span>{level === l.n && <Check size={16} aria-hidden="true" />}
          </button>
        ))}
      </div>
      <label className="tk-flabel tk-gap" htmlFor="escalate-reason">Why <span className="tk-muted">required</span></label>
      <textarea id="escalate-reason" className={classNames('tk-ta', error && 'bad')} value={reason} aria-invalid={error || undefined}
        onChange={(e) => { setReason(e.target.value); setError(false); }} placeholder="What is blocking it and what you need" data-testid="escalate-reason" />
      {error && <div className="tk-err">Say why it needs to go up.</div>}
    </Modal>
  );
}
