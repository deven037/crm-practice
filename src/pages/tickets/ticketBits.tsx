import { CSSProperties, PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from 'react';
import { Building2, Globe, Inbox, Mail, MessageCircle, Phone, Shuffle } from 'lucide-react';
import { Ticket, TicketPriority, User } from '../../types';
import { classNames } from '../../utils';
import { contactHue } from '../contacts/contactBits';
import {
  firstReplyInfo, fuseText, isOpenTicket, leftMs, PRIORITY_LEVEL, priorityHue, slaState, SLA_HUE, spanText, stateHue, statusHue,
  ticketRef, usedShare, whenText,
} from './ticketLogic';

export const hue = (c: string) => ({ '--c': c }) as CSSProperties;

/** The current time, refreshed every `every` milliseconds while the component is shown. */
export function useClock(every = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), every);
    return () => window.clearInterval(id);
  }, [every]);
  return now;
}

export function PriorityMark({ priority, label = true }: { priority: TicketPriority | string; label?: boolean }) {
  const level = PRIORITY_LEVEL[priority as TicketPriority] ?? 1;
  return (
    <span className="tk-pr" style={hue(priorityHue(priority))} title={`${priority} priority`}>
      <span className="tk-bars" aria-hidden="true">
        {[1, 2, 3, 4].map((n) => <i key={n} className={n <= level ? 'on' : undefined} />)}
      </span>
      {label ? priority : <span className="sr-only">{priority}</span>}
    </span>
  );
}

export function StatusPill({ status }: { status: string }) {
  return <span className="tk-pill" style={hue(statusHue(status))}><i />{status}</span>;
}

const CHANNEL_ICON: Record<string, typeof Mail> = { email: Mail, phone: Phone, whatsapp: MessageCircle, branch: Building2, portal: Globe };

export function ChannelMark({ channel }: { channel?: string }) {
  if (!channel) return null;
  const Icon = CHANNEL_ICON[channel.toLowerCase()] ?? Inbox;
  return <span className="tk-chn"><Icon size={13} aria-hidden="true" />{channel}</span>;
}

export function UserFace({ user, large }: { user?: Pick<User, 'id' | 'name'> | null; large?: boolean }) {
  if (!user) return null;
  const letters = user.name.split(' ').filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  return <i className={classNames('tk-face', large && 'lg')} style={{ '--h': contactHue(user.id) } as CSSProperties} title={user.name}>{letters}</i>;
}

/** A bar that fills as the ticket uses its SLA time, with the time left under it. Ticks every second. */
export function Fuse({ ticket, warnPercent, compact }: { ticket: Ticket; warnPercent: number; compact?: boolean }) {
  const now = useClock(1000);
  const state = slaState(ticket, now, warnPercent);
  const [main, sub] = fuseText(ticket, now, warnPercent);
  const used = state === 'done' || state === 'breach' ? 1 : usedShare(ticket, now);
  return (
    <div className={classNames('tk-fz', compact && 'compact')} style={hue(stateHue(ticket, now, warnPercent))} data-testid={`sla-fuse-${ticket.id}`}>
      <div className={classNames('tk-fuse', state)} role="meter" aria-label="SLA time used" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(used * 100)}>
        <i style={{ width: `${(used * 100).toFixed(2)}%` }} />
      </div>
      <div className="tk-fuse-t"><b>{main}</b>{!compact && <span>{sub}</span>}</div>
    </div>
  );
}

/** "First reply in 20 m" / "First reply 5 m late" while nobody has answered the customer. */
export function FirstReplyChip({ ticket }: { ticket: Ticket }) {
  const now = useClock(15_000);
  const info = firstReplyInfo(ticket, now);
  if (!info) return null;
  return (
    <span className={classNames('tk-frc', info.late && 'late')}>
      <MessageCircle size={12} aria-hidden="true" />
      {info.late ? `First reply ${spanText(info.ms)} late` : `First reply in ${spanText(info.ms)}`}
    </span>
  );
}

/**
 * The next 12 hours as a clock face: every running ticket sits on its priority's ring at the time it is due,
 * "now" at the top. Breached tickets gather in the red centre.
 */
export function SlaDial({ tickets, now, warnPercent, onOpen }: { tickets: Ticket[]; now: number; warnPercent: number; onOpen: (id: string) => void }) {
  const cx = 118;
  const cy = 118;
  const ring: Record<number, number> = { 4: 100, 3: 84, 2: 68, 1: 52 };
  const running = tickets.filter((t) => ['ok', 'warn', 'hot', 'breach'].includes(slaState(t, now, warnPercent)));
  const breached = running.filter((t) => leftMs(t, now) < 0);
  const soon = running.filter((t) => leftMs(t, now) >= 0 && leftMs(t, now) <= 12 * 3_600_000);
  const later = running.length - breached.length - soon.length;
  const at = (r: number, a: number) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  const angle = (minutes: number) => -Math.PI / 2 + (minutes / 720) * Math.PI * 2;
  const arc = (r: number, a0: number, a1: number) => {
    const [x0, y0] = at(r, a0);
    const [x1, y1] = at(r, a1);
    return `M${x0.toFixed(1)} ${y0.toFixed(1)}A${r} ${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
  };
  return (
    <div className="tk-dialcard" data-testid="sla-dial">
      <svg viewBox="-14 -6 264 258" role="img" aria-label={`SLA clock: ${breached.length} breached, ${soon.length} due in the next 12 hours`}>
        <path d={arc(110, angle(0), angle(60))} stroke="color-mix(in srgb, #d33a3a 30%, transparent)" strokeWidth={10} fill="none" strokeLinecap="round" />
        <path d={arc(110, angle(60), angle(240))} stroke="color-mix(in srgb, #d9a21a 22%, transparent)" strokeWidth={10} fill="none" />
        {[4, 3, 2, 1].map((lv) => <circle key={lv} cx={cx} cy={cy} r={ring[lv]} fill="none" stroke="var(--border)" strokeDasharray="2 4" />)}
        {Array.from({ length: 12 }, (_, h) => {
          const [x0, y0] = at(116, angle(h * 60));
          const [x1, y1] = at(h % 3 ? 112 : 108, angle(h * 60));
          return <line key={h} x1={x0} y1={y0} x2={x1} y2={y1} stroke="var(--border-strong)" strokeWidth={h % 3 ? 1 : 2} />;
        })}
        {([[0, 'now'], [180, '3 h'], [360, '6 h'], [540, '9 h']] as const).map(([m, l]) => {
          const [x, y] = at(127, angle(m));
          return <text key={l} x={x} y={y + 4} textAnchor="middle" fontSize={10.5} fill={m ? 'var(--text-muted)' : 'var(--bank-ink)'} fontWeight={m ? 400 : 650}>{l}</text>;
        })}
        <line className="tk-hand" x1={cx} y1={cy - 36} x2={cx} y2={cy - 104} />
        {soon.map((t) => {
          const [x, y] = at(ring[PRIORITY_LEVEL[t.priority] ?? 1], angle(leftMs(t, now) / 60_000));
          return (
            <circle key={t.id} className="tk-dot" cx={x} cy={y} r={7} fill={priorityHue(t.priority)} stroke="var(--surface)" strokeWidth={2.5}
              role="link" tabIndex={0} aria-label={`${ticketRef(t)} ${t.subject}, ${spanText(leftMs(t, now))} left`}
              onClick={() => onOpen(t.id)} onKeyDown={(e) => { if (e.key === 'Enter') onOpen(t.id); }}>
              <title>{`${ticketRef(t)} ${t.subject} · ${spanText(leftMs(t, now))} left`}</title>
            </circle>
          );
        })}
        <g className={breached.length ? 'tk-core' : undefined}>
          <circle cx={cx} cy={cy} r={34} fill={breached.length ? 'color-mix(in srgb, #d33a3a 16%, var(--surface))' : 'var(--surface-2)'} stroke={breached.length ? '#d33a3a' : 'var(--border)'} strokeWidth={2} />
          <text x={cx} y={cy + 4} textAnchor="middle" fontSize={24} fontWeight={700} fontFamily="var(--font-display)" fill={breached.length ? 'var(--tone-danger-text, #a12626)' : 'var(--text-muted)'}>{breached.length}</text>
          <text x={cx} y={cy + 19} textAnchor="middle" fontSize={9.5} fill="var(--text-muted)">breached</text>
        </g>
        {breached.slice(0, 8).map((t, i) => {
          const [x, y] = at(42, -Math.PI / 2 + 0.5 + i * 0.45);
          return (
            <circle key={t.id} className="tk-dot" cx={x} cy={y} r={4.5} fill="#d33a3a" stroke="var(--surface)" strokeWidth={1.5} role="link" tabIndex={0}
              aria-label={`${ticketRef(t)} breached ${spanText(-leftMs(t, now))} ago`} onClick={() => onOpen(t.id)} onKeyDown={(e) => { if (e.key === 'Enter') onOpen(t.id); }}>
              <title>{`${ticketRef(t)} ${t.subject} · breached ${spanText(-leftMs(t, now))} ago`}</title>
            </circle>
          );
        })}
      </svg>
      <div className="tk-cap">
        Next 12 hours. Rings by priority, Urgent outside.
        {later > 0 && <><br />{later} {later === 1 ? 'ticket' : 'tickets'} due later.</>}
      </div>
    </div>
  );
}

/* ---------- team board: drag a ticket onto a person ---------- */

const CAPACITY = 6;
const WORST: string[] = ['breach', 'hot', 'warn', 'ok', 'paused'];

function TicketChip({ ticket, warnPercent, lifted, onPointerDown }: { ticket: Ticket; warnPercent: number; lifted?: boolean; onPointerDown?: (e: ReactPointerEvent<HTMLDivElement>) => void }) {
  return (
    <div className={classNames('tk-chip', lifted && 'lifted')} data-chip={ticket.id} data-testid={`team-chip-${ticket.id}`} onPointerDown={onPointerDown}>
      <div className="tk-chip-t"><PriorityMark priority={ticket.priority} label={false} /><span className="tk-id">{ticketRef(ticket)}</span><span>{ticket.subject}</span></div>
      <Fuse ticket={ticket} warnPercent={warnPercent} compact />
    </div>
  );
}

interface Drag { id: string; x: number; y: number; on: boolean; over: string | null; left: number; top: number }

export function TeamBoard({ tickets, allOpen, users, warnPercent, canWrite, onAssign, onOpen }: {
  tickets: Ticket[]; allOpen: Ticket[]; users: User[]; warnPercent: number; canWrite: boolean;
  onAssign: (id: string, ownerId: string | null) => void; onOpen: (id: string) => void;
}) {
  const now = useClock(15_000);
  const wrap = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  dragRef.current = drag;

  useEffect(() => {
    if (!drag) return;
    const move = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      if (!d.on && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 6) return;
      const box = wrap.current?.getBoundingClientRect();
      const zone = (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null)?.closest<HTMLElement>('[data-drop]');
      setDrag({ ...d, on: true, over: zone ? zone.dataset.drop ?? '' : null, left: e.clientX - (box?.left ?? 0) - 110, top: e.clientY - (box?.top ?? 0) - 24 });
    };
    const up = () => {
      const d = dragRef.current;
      setDrag(null);
      document.body.classList.remove('tk-dragging');
      if (!d) return;
      if (!d.on) { onOpen(d.id); return; }
      if (d.over !== null) {
        const owner = d.over || null;
        const t = tickets.find((x) => x.id === d.id);
        if (t && (t.ownerId ?? null) !== owner) onAssign(d.id, owner);
      }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag?.id]);

  const start = (id: string) => (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if (!canWrite) { onOpen(id); return; }
    e.preventDefault();
    document.body.classList.add('tk-dragging');
    setDrag({ id, x: e.clientX, y: e.clientY, on: false, over: null, left: 0, top: 0 });
  };

  const unassigned = tickets.filter((t) => !t.ownerId);
  const flying = drag?.on ? tickets.find((t) => t.id === drag.id) : undefined;
  return (
    <div className="tk-team" ref={wrap} data-testid="ticket-team-board">
      <div className={classNames('tk-tray', drag?.on && drag.over === '' && 'over')} data-drop="">
        <h3><Shuffle size={16} aria-hidden="true" /> Unassigned <small>{canWrite ? 'drag a ticket onto a person to assign it' : 'tickets nobody has taken yet'}</small></h3>
        <div className="tk-tray-chips">
          {unassigned.length === 0 && <span className="tk-muted">Every open ticket has an owner.</span>}
          {unassigned.map((t) => <TicketChip key={t.id} ticket={t} warnPercent={warnPercent} lifted={drag?.on && drag.id === t.id} onPointerDown={start(t.id)} />)}
        </div>
      </div>
      <div className="tk-crew">
        {users.map((u, i) => {
          const theirs = allOpen.filter((t) => t.ownerId === u.id);
          const shown = tickets.filter((t) => t.ownerId === u.id).sort((a, b) => leftMs(a, now) - leftMs(b, now));
          const worst = theirs.reduce<string>((w, t) => (WORST.indexOf(slaState(t, now, warnPercent)) < WORST.indexOf(w) ? slaState(t, now, warnPercent) : w), 'paused');
          const next = theirs.filter((t) => !t.pausedAt).sort((a, b) => leftMs(a, now) - leftMs(b, now))[0];
          return (
            <div key={u.id} className={classNames('tk-agent', drag?.on && drag.over === u.id && 'over')} data-drop={u.id} style={{ animationDelay: `${i * 50}ms` }} data-testid={`team-agent-${u.id}`}>
              <div className="tk-agent-h"><UserFace user={u} large /><div><b>{u.name}</b><small>{u.role === 'admin' ? 'Admin' : 'Rep'}</small></div></div>
              <div className="tk-load" style={hue(SLA_HUE[worst as keyof typeof SLA_HUE] ?? SLA_HUE.ok)} aria-label={`${theirs.length} of ${CAPACITY} open`}>
                {Array.from({ length: Math.max(CAPACITY, theirs.length) }, (_, k) => <i key={k} className={k < theirs.length ? 'on' : undefined} />)}
              </div>
              <div className="tk-load-t"><span>{theirs.length} of {CAPACITY} open</span><span>{next ? (leftMs(next, now) < 0 ? 'breach now' : `next due in ${spanText(leftMs(next, now))}`) : 'nothing due'}</span></div>
              <div className="tk-chips">
                {shown.map((t) => <TicketChip key={t.id} ticket={t} warnPercent={warnPercent} lifted={drag?.on && drag.id === t.id} onPointerDown={start(t.id)} />)}
              </div>
            </div>
          );
        })}
      </div>
      {flying && drag && (
        <div className="tk-fly" style={{ left: drag.left, top: drag.top }} aria-hidden="true">
          <TicketChip ticket={flying} warnPercent={warnPercent} />
        </div>
      )}
    </div>
  );
}

/* ---------- ticket room: the live timer and the time track ---------- */

export function LiveTimer({ ticket, warnPercent }: { ticket: Ticket; warnPercent: number }) {
  const now = useClock(1000);
  const state = slaState(ticket, now, warnPercent);
  const left = leftMs(ticket, now);
  const color = stateHue(ticket, now, warnPercent);
  let big: string;
  let small: string;
  if (state === 'done') {
    const met = left >= 0;
    big = met ? 'Met' : 'Missed';
    small = `${met ? `${spanText(left)} to spare` : `${spanText(-left)} late`} · resolved ${ticket.resolvedAt ? whenText(ticket.resolvedAt, now) : ''}`;
  } else if (state === 'paused') {
    big = hms(left);
    small = 'paused while waiting on the customer';
  } else if (state === 'breach') {
    big = `+${hms(-left)}`;
    small = 'over the SLA';
  } else {
    big = hms(left);
    small = 'left to resolve';
  }
  return (
    <>
      <span className="tk-timer" style={hue(color)} data-testid="sla-countdown">{big}</span>
      <span className="tk-timer-l">{small}</span>
    </>
  );
}

function hms(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/** Created, first reply, now and resolve-by on one bar, with paused and overdue stretches marked. */
export function TimeTrack({ ticket, warnPercent }: { ticket: Ticket; warnPercent: number }) {
  const now = useClock(10_000);
  const t0 = Date.parse(ticket.createdAt);
  const due = Date.parse(ticket.slaDue);
  const frd = ticket.firstReplyDue ? Date.parse(ticket.firstReplyDue) : NaN;
  const open = isOpenTicket(ticket);
  const end = !open && ticket.resolvedAt ? Date.parse(ticket.resolvedAt) : ticket.pausedAt ? Date.parse(ticket.pausedAt) : now;
  const last = Math.max(due, end);
  const b = last + (last - t0) * 0.06;
  const X = (m: number) => Math.max(0, Math.min(100, ((m - t0) / (b - t0)) * 100));
  const c = stateHue(ticket, now, warnPercent);
  const frAt = ticket.firstReplyAt ? Date.parse(ticket.firstReplyAt) : NaN;
  const frX = X(Number.isFinite(frAt) ? frAt : frd);
  const showFr = Number.isFinite(frd) && frX > 10 && frX < 86;
  const nowX = X(now);
  const showNow = open && !ticket.pausedAt && nowX > 6 && nowX < 92 && (!showFr || Math.abs(nowX - frX) > 7);
  return (
    <div className="tk-trk" style={hue(c)}>
      <div className="tk-trk-bar">
        <div className="tk-trk-fill" style={{ width: `${X(Math.min(end, due))}%` }} />
        {end > due && <div className="tk-trk-over" style={{ left: `${X(due)}%`, width: `${X(end) - X(due)}%` }} />}
        {ticket.pausedAt && <div className="tk-trk-pause" style={{ left: `${X(Date.parse(ticket.pausedAt))}%`, width: `${100 - X(Date.parse(ticket.pausedAt))}%` }} />}
      </div>
      <div className="tk-mk start" style={{ left: '0%', ...hue('var(--text-muted)') }}><i /><small>Created <b>{whenText(t0, now, true)}</b></small></div>
      {showFr && (
        <div className="tk-mk mid" style={{ left: `${frX}%`, ...hue(Number.isFinite(frAt) && frAt <= frd ? '#1f9d63' : '#d9a21a') }}>
          <i /><small>First reply {Number.isFinite(frAt) ? <b>{whenText(frAt, now, true)}</b> : `due ${whenText(frd, now, true)}`}</small>
        </div>
      )}
      {showNow && <div className="tk-mk now mid" style={{ left: `${nowX}%` }}><i /><small>now</small></div>}
      <div className={classNames('tk-mk flag', X(due) > 88 && 'end')} style={{ left: `${X(due)}%`, ...hue(c) }}><i /><small>Resolve by <b>{whenText(due, now, true)}</b></small></div>
    </div>
  );
}
