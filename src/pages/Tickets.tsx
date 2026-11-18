import { CSSProperties, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowUp, Clock, Layers, List, Plus, Search, Users as UsersIcon } from 'lucide-react';
import { getAll, getAllSync } from '../data/store';
import { apiFetch } from '../data/apiFetch';
import { Ticket, User } from '../types';
import { ToolBoxMenu } from '../components/ToolBoxMenu';
import { LayoutPickerPanel } from '../components/LayoutPickerPanel';
import { useToast } from '../components/Toast';
import { useAuth } from '../auth/AuthContext';
import { classNames } from '../utils';
import { StatusPicker } from './leads/StatusPicker';
import { SearchPicker } from './deals/dealBits';
import {
  canWriteTickets, isOpenTicket, leftMs, matchesSearch, metThisWeek, PRIORITY_ORDER, priorityHue, slaRulesNow, slaState, sortQueue, staffOf,
  ticketRef, TICKET_VIEWS, viewById, ViewContext,
} from './tickets/ticketLogic';
import { ChannelMark, FirstReplyChip, Fuse, PriorityMark, SlaDial, StatusPill, TeamBoard, UserFace } from './tickets/ticketBits';

export const TICKET_TOOLBOX_LINKS = [
  { label: 'SLA policies', to: '/setup/sla' },
  { label: 'Status codes', to: '/setup/status-codes' },
  { label: 'Custom fields', to: '/admin/objects/tickets' },
  { label: 'Customise page layout', to: '/setup/layouts/tickets' },
];

/** Applies an updated ticket to a list (a copy, never the store's own array). */
export const replaceTicket = (list: Ticket[], next: Ticket) => list.map((t) => (t.id === next.id ? next : t));

/**
 * The service desk: an SLA dial and tiles that double as views, then every ticket sorted by the time it has left,
 * each with a fuse that fills as its SLA time runs out. Team view hands tickets out by dragging them onto people.
 */
export function Tickets() {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const { user } = useAuth();
  const canWrite = canWriteTickets(user?.role);
  const [params] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  // Dashboard tile link: /tickets?status=open
  const [view, setView] = useState(params.get('view') ?? 'open');
  const [query, setQuery] = useState('');
  const [priorities, setPriorities] = useState<string[]>([]);
  const [mode, setMode] = useState<'queue' | 'team'>('queue');
  const [now, setNow] = useState(() => Date.now());
  const [layoutPickerOpen, setLayoutPickerOpen] = useState(false);
  const landed = (location.state as { landed?: string } | null)?.landed ?? null;

  useEffect(() => {
    let alive = true;
    const check = async () => {
      // The server applies escalation and auto-assign rules; changed tickets come back.
      try {
        const { changed } = await apiFetch<{ changed: Ticket[] }>('/tickets/sla-check', { method: 'POST' });
        if (alive && changed.length) setTickets((list) => changed.reduce(replaceTicket, list));
      } catch {
        // The queue still works without it; the next check tries again.
      }
    };
    (async () => {
      try {
        const [list, people] = await Promise.all([getAll<Ticket>('tickets'), getAll<User>('users').catch(() => getAllSync<User>('users'))]);
        if (!alive) return;
        setTickets([...list]);
        setUsers([...people]);
        setFailed(false);
      } catch {
        if (alive) setFailed(true);
      }
      if (alive) setLoading(false);
      if (canWrite) check();
    })();
    const tick = window.setInterval(() => setNow(Date.now()), 15_000);
    const sweep = window.setInterval(() => { if (canWrite) check(); }, 60_000);
    return () => { alive = false; window.clearInterval(tick); window.clearInterval(sweep); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const warnPercent = slaRulesNow().warnPercent;
  const ctx: ViewContext = { now, me: user?.id, warnPercent };
  const staff = staffOf(users);
  const userById = (id: string | null | undefined) => users.find((u) => u.id === id);
  const visible = useMemo(
    () => sortQueue(
      tickets.filter((t) => viewById(view).test(t, ctx)).filter((t) => !priorities.length || priorities.includes(t.priority)).filter((t) => matchesSearch(t, query, userById(t.ownerId)?.name ?? '')),
      now,
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tickets, view, priorities, query, now, users],
  );
  const count = (id: string) => tickets.filter((t) => viewById(id).test(t, ctx)).length;
  const openCount = tickets.filter(isOpenTicket).length;
  const met = metThisWeek(tickets, now);

  const assign = async (id: string, ownerId: string | null) => {
    const before = tickets;
    setTickets((list) => list.map((t) => (t.id === id ? { ...t, ownerId } : t)));
    try {
      const saved = await apiFetch<Ticket>(`/tickets/${id}/assign`, { method: 'POST', body: JSON.stringify({ ownerId }) });
      setTickets((list) => replaceTicket(list, saved));
      const who = userById(ownerId);
      toast.push('success', ownerId === user?.id ? `${ticketRef(saved)} is yours.` : who ? `${ticketRef(saved)} assigned to ${who.name}.` : `${ticketRef(saved)} is back in Unassigned.`);
    } catch {
      setTickets(before);
      toast.push('error', 'The ticket couldn’t be assigned. Check your connection and try again.');
    }
  };

  const tiles = [
    { id: 'breach', label: 'Breached', sub: 'past their resolve time', hue: '#d33a3a', hot: true },
    { id: 'hour', label: 'Due within 1 hour', sub: 'act on these next', hue: '#e0611a' },
    { id: 'firstreply', label: 'First reply due', sub: 'nobody has answered yet', hue: '#d9a21a' },
    { id: 'unassigned', label: 'Unassigned', sub: 'waiting to be picked up', hue: '#2f6fe0' },
    { id: 'paused', label: 'Paused', sub: 'waiting on the customer', hue: '#8a93a6' },
  ];

  return (
    <div className="tk3" data-testid="tickets-page">
      <div className="page-header">
        <div>
          <h1>Tickets</h1>
          <p className="tk-sub">{openCount} open {openCount === 1 ? 'ticket' : 'tickets'} · the clock runs on each ticket’s SLA policy</p>
        </div>
        <div className="page-actions">
          <ToolBoxMenu links={TICKET_TOOLBOX_LINKS} />
          {canWrite && (
            <button className="btn btn-primary contacts-primary" data-testid="new-ticket" onClick={() => setLayoutPickerOpen(true)}>
              <Plus size={16} aria-hidden="true" /> New ticket
            </button>
          )}
        </div>
      </div>

      {failed && <div className="banner banner-error" role="alert">Tickets couldn’t load. Check your connection and reload the page.</div>}

      {!loading && !failed && (
        <div className="tk-desk">
          <SlaDial tickets={tickets} now={now} warnPercent={warnPercent} onOpen={(id) => navigate(`/tickets/${id}`)} />
          <div className="tk-tiles">
            {tiles.map((tile, i) => {
              const n = count(tile.id);
              return (
                <button
                  key={tile.id}
                  type="button"
                  className={classNames('tk-tile', tile.hot && n > 0 && 'hot')}
                  style={{ animationDelay: `${i * 40}ms` }}
                  aria-pressed={view === tile.id}
                  data-testid={`ticket-tile-${tile.id}`}
                  onClick={() => setView(view === tile.id ? 'open' : tile.id)}
                >
                  <span className="tk-lab"><i style={{ background: tile.hue }} />{tile.label}</span>
                  <b>{n}</b>
                  <small>{tile.sub}</small>
                </button>
              );
            })}
            <div className="tk-tile" style={{ animationDelay: '200ms' }} data-testid="ticket-tile-met">
              <span className="tk-lab"><i style={{ background: '#1f9d63' }} />Met SLA this week</span>
              <b>{met.share === null ? '—' : `${met.share}%`}</b>
              <div className="tk-mbars" aria-hidden="true">
                {met.days.map((d, i) => <i key={i} className={classNames(d !== null && d < 90 && 'lo', d === null && 'none')} style={{ height: d === null ? 3 : Math.max(4, (d / 100) * 22), animationDelay: `${300 + i * 50}ms` }} />)}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="tk-tools">
        <div className="tk-viewpick">
          <Layers size={15} aria-hidden="true" />
          <SearchPicker
            label="View"
            find="Find a view"
            value={view}
            testId="ticket-view-picker"
            options={TICKET_VIEWS.map((v) => ({ value: v.id, label: v.label, hint: String(count(v.id)) }))}
            onPick={setView}
          />
        </div>
        <div className="contact-find tk-search">
          <Search size={17} aria-hidden="true" />
          <input type="search" className="input search-input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search subject, customer, ID" aria-label="Search tickets" data-testid="ticket-search" />
        </div>
        <StatusPicker
          options={[...PRIORITY_ORDER]}
          selected={priorities}
          multi
          label="Priority"
          testId="ticket-priority-filter"
          className={classNames('tk-fchip', priorities.length > 0 && 'set')}
          onPick={(p) => setPriorities((list) => (list.includes(p) ? list.filter((x) => x !== p) : [...list, p]))}
        >
          {priorities.length ? `Priority: ${priorities.join(', ')}` : '+ Priority'}
        </StatusPicker>
        <span className="tk-spacer" />
        <div className="tk-seg" role="group" aria-label="View mode">
          <button type="button" aria-pressed={mode === 'queue'} data-testid="view-queue" onClick={() => setMode('queue')}><List size={14} aria-hidden="true" /> Queue</button>
          <button type="button" aria-pressed={mode === 'team'} data-testid="view-team" onClick={() => setMode('team')}><UsersIcon size={14} aria-hidden="true" /> Team</button>
        </div>
      </div>

      {loading ? (
        <div className="tk-card tk-q"><div className="tk-empty">Loading tickets…</div></div>
      ) : mode === 'team' ? (
        <TeamBoard
          tickets={visible.filter(isOpenTicket)}
          allOpen={tickets.filter(isOpenTicket)}
          users={staff}
          warnPercent={warnPercent}
          canWrite={canWrite}
          onAssign={assign}
          onOpen={(id) => navigate(`/tickets/${id}`)}
        />
      ) : (
        <div className="tk-card tk-q" data-testid="ticket-queue">
          <div className="tk-qhead"><span /><span>Ticket · sorted by time left</span><span className="tk-hs">Status</span><span>Owner</span><span>SLA</span></div>
          {visible.length === 0 && (
            <div className="tk-empty"><b>Nothing here</b>{tickets.length === 0 ? (canWrite ? 'No tickets yet. Create the first one with New ticket.' : 'No tickets yet.') : `No ticket matches this view${query ? ' and search' : ''}.`}</div>
          )}
          {visible.map((t, i) => {
            const state = slaState(t, now, warnPercent);
            const owner = userById(t.ownerId);
            return (
              <div
                key={t.id}
                className={classNames('tk-qrow', state, landed === t.id && 'landed')}
                style={{ '--c': priorityHue(t.priority), animationDelay: `${Math.min(i, 12) * 30}ms` } as CSSProperties}
                data-testid={`ticket-inbox-row-${t.id}`}
                onClick={(e) => { if (!(e.target as HTMLElement).closest('a, button')) navigate(`/tickets/${t.id}`); }}
              >
                <span className="tk-stripe" />
                <div className="tk-qm">
                  <div className="tk-qt">
                    <span className="tk-id">{ticketRef(t)}</span>
                    <Link to={`/tickets/${t.id}`} className="tk-qlink">{t.subject}</Link>
                    {(t.escalation ?? 0) > 0 && isOpenTicket(t) && <em className="tk-esc"><ArrowUp size={11} aria-hidden="true" />L{t.escalation}</em>}
                  </div>
                  <div className="tk-qs">
                    <span className="tk-who"><b>{t.requester}</b></span>
                    <ChannelMark channel={t.channel} />
                    <PriorityMark priority={t.priority} />
                    <FirstReplyChip ticket={t} />
                  </div>
                </div>
                <div className="tk-stc"><StatusPill status={t.status} /></div>
                <div className="tk-ownc">
                  {owner ? (
                    <><UserFace user={owner} /><span className="tk-nm">{owner.name.split(' ')[0]}</span></>
                  ) : isOpenTicket(t) && canWrite ? (
                    <button type="button" className="tk-take" data-testid={`take-${t.id}`} onClick={() => user && assign(t.id, user.id)}><Plus size={13} aria-hidden="true" />Take</button>
                  ) : (
                    <span className="tk-muted">—</span>
                  )}
                </div>
                <Fuse ticket={t} warnPercent={warnPercent} />
              </div>
            );
          })}
          <div className="tk-qfoot"><Clock size={14} aria-hidden="true" />Working-hours clocks skip nights, Sundays and the hours set in SLA policies.{' '}
            {visible.some((t) => isOpenTicket(t) && leftMs(t, now) < 0) && <span>Breached tickets escalate by themselves.</span>}
          </div>
        </div>
      )}

      {layoutPickerOpen && <LayoutPickerPanel module="tickets" basePath="/tickets" onClose={() => setLayoutPickerOpen(false)} />}
    </div>
  );
}
