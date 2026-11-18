import { CSSProperties, PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Clock, Link2, MapPin, Pencil, Plus, Users, X } from 'lucide-react';
import { getAll, upsert } from '../data/store';
import { Meeting, TaskItem, User } from '../types';
import { SkeletonRows } from '../components/Spinner';
import { ToolBoxMenu } from '../components/ToolBoxMenu';
import { useToast } from '../components/Toast';
import { useAuth } from '../auth/AuthContext';
import { classNames } from '../utils';
import { TagPicker } from './contacts/contactBits';
import { useNarrow } from './accounts/accountBits';
import { canManageTasks, ACTIVITY_TOOLBOX_LINKS } from './Tasks';
import {
  addDays, DAY_END, DAY_START, dayLabel, dayOffset, hm, isoAt, lanes, minutesOf, ownedBy, PRIORITY_HUE, relativeDay, snapStart, spanLabel, weekStart,
} from './activity/activityLogic';
import { activityTypes, Face, findTarget, hue, linkTargets, RecordChip, typeStyle } from './activity/activityBits';

const HOUR = 52;
const HOURS = (DAY_END - DAY_START) / 60;
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

interface Drag {
  id: string;
  x: number;
  y: number;
  grab: number;
  day: number;
  start: number;
  moved: boolean;
}

/** The calendar: a week you can drag meetings around in, a month overview, and a day-by-day list on phones. */
export function Calendar() {
  const toast = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canManage = canManageTasks(user?.role);
  const narrow = useNarrow();
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [anchor, setAnchor] = useState(() => weekStart(new Date()));
  const [view, setView] = useState<'week' | 'month'>('week');
  const [people, setPeople] = useState<string[]>(user?.id ? [user.id] : []);
  const [card, setCard] = useState<{ id: string; x: number; y: number } | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const targets = useMemo(() => linkTargets(), [meetings]);
  const now = new Date();

  const load = async () => {
    setFailed(false);
    try {
      const [m, t, u] = await Promise.all([
        getAll<Meeting>('meetings'),
        getAll<TaskItem>('tasks').catch((): TaskItem[] => []),
        getAll<User>('users').catch((): User[] => []),
      ]);
      setMeetings([...m]);
      setTasks([...t]);
      setUsers(u);
    } catch {
      setFailed(true);
    }
    setLoading(false);
  };
  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!card) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setCard(null); };
    const onDown = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest('.act-evcard, .act-ev')) setCard(null); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onDown); };
  }, [card]);

  const shown = meetings.filter((m) => !people.length || m.attendeeIds.some((id) => people.includes(id)));
  const days = Array.from({ length: 7 }, (_, i) => addDays(anchor, i));
  const personChoices = [...users].sort((a, b) => a.name.localeCompare(b.name));
  const step = (by: number) => {
    setCard(null);
    if (view === 'month') setAnchor((a) => weekStart(new Date(a.getFullYear(), a.getMonth() + by + (a.getDate() > 7 ? 1 : 0), 1)));
    else setAnchor((a) => addDays(a, by * 7));
  };
  const monthOf = view === 'month' ? new Date(anchor.getFullYear(), anchor.getMonth() + (anchor.getDate() > 7 ? 1 : 0), 1) : null;
  const title = view === 'month' && monthOf
    ? monthOf.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
    : `${days[0].getDate()} ${days[0].getMonth() === days[6].getMonth() ? '' : days[0].toLocaleDateString('en-GB', { month: 'short' }) + ' '}– ${days[6].toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;

  const openCard = (m: Meeting, el: HTMLElement) => {
    const box = wrap.current?.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    if (!box) return;
    setCard({ id: m.id, x: Math.max(8, Math.min(box.width - 320, r.left - box.left)), y: r.bottom - box.top + 8 });
  };

  /*
   * Drag a meeting to another day or time; a press without a move opens its card. Moving into another day's
   * column re-creates the block there, so the move and the release are followed on the window, not the block.
   */
  const live = useRef({ meetings, anchor, canManage });
  live.current = { meetings, anchor, canManage };
  const onEventDown = (e: ReactPointerEvent, m: Meeting) => {
    if (e.button !== 0) return;
    const el = e.currentTarget as HTMLElement;
    const r = el.getBoundingClientRect();
    dragRef.current = { id: m.id, x: e.clientX, y: e.clientY, grab: e.clientY - r.top, day: dayOffset(m.start, anchor), start: minutesOf(m.start), moved: false };
    const onMove = (ev: PointerEvent) => {
      const d = dragRef.current;
      if (!d || !live.current.canManage) return;
      if (!d.moved && Math.hypot(ev.clientX - d.x, ev.clientY - d.y) < 5) return;
      const meeting = live.current.meetings.find((x) => x.id === d.id);
      const hit = document.elementsFromPoint(ev.clientX, ev.clientY).find((node) => (node as HTMLElement).dataset?.col) as HTMLElement | undefined;
      if (!meeting || !hit) return;
      const box = hit.getBoundingClientRect();
      const next = { ...d, moved: true, day: Number(hit.dataset.col), start: snapStart(ev.clientY - d.grab - box.top, HOUR, meeting.durationMin) };
      dragRef.current = next;
      setCard(null);
      setDrag(next);
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      const d = dragRef.current;
      dragRef.current = null;
      setDrag(null);
      if (d) finishDrag(d, m, el);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };
  const finishDrag = async (d: Drag, m: Meeting, el: HTMLElement) => {
    if (!d.moved) return openCard(m, el);
    const { anchor } = live.current;
    const start = isoAt(addDays(anchor, d.day), d.start);
    if (start === m.start) return;
    const moved = { ...m, start };
    setMeetings((list) => list.map((x) => (x.id === m.id ? moved : x)));
    try {
      const saved = await upsert('meetings', moved);
      setMeetings((list) => list.map((x) => (x.id === saved.id ? saved : x)));
      toast.push('success', `Moved to ${relativeDay(addDays(anchor, d.day)).toLowerCase() === 'today' ? 'today' : dayLabel(addDays(anchor, d.day))} ${hm(d.start)}.`);
    } catch {
      setMeetings((list) => list.map((x) => (x.id === m.id ? m : x)));
      toast.push('error', 'The meeting couldn’t be moved. It is back where it was.');
    }
  };
  const onSlot = (e: ReactPointerEvent<HTMLDivElement>, day: Date) => {
    if (!canManage || (e.target as HTMLElement).closest('.act-ev')) return;
    const r = e.currentTarget.getBoundingClientRect();
    const start = Math.min(DAY_END - 30, DAY_START + Math.floor(((e.clientY - r.top) / HOUR) * 2) * 30);
    navigate(`/calendar/new?date=${iso(day)}&start=${hm(start)}`);
  };

  const cardMeeting = card ? meetings.find((m) => m.id === card.id) : undefined;

  const week = (
    <section className="card act-week" style={{ '--hp': `${HOUR}px` } as CSSProperties} data-testid="calendar-week">
      <div className="act-wk-head">
        <div />
        {days.map((d) => (
          <div key={d.toISOString()} className={classNames(dayOffset(d, now) === 0 && 'today')}>
            {d.toLocaleDateString('en-GB', { weekday: 'short' })}<b>{d.getDate()}</b>
          </div>
        ))}
      </div>
      <div className="act-wk-all">
        <div>Tasks</div>
        {days.map((d) => {
          const due = tasks.filter((t) => dayOffset(t.dueDate, d) === 0 && ownedBy(t, people));
          return (
            <div key={d.toISOString()}>
              {due.slice(0, 2).map((t) => (
                <Link key={t.id} to="/tasks" className={classNames('act-wk-task', t.completed && 'done')} style={hue(PRIORITY_HUE[t.priority])} title={t.title}>{t.title}</Link>
              ))}
              {due.length > 2 && <Link to="/tasks" className="act-more">+{due.length - 2} more</Link>}
            </div>
          );
        })}
      </div>
      <div className="act-wk-body">
        <div className="act-wk-hours">
          {Array.from({ length: HOURS }, (_, i) => <div key={i}>{i > 0 && <span>{hm(DAY_START + i * 60)}</span>}</div>)}
        </div>
        {days.map((d, col) => {
          const here = shown
            .map((m) => (drag && drag.id === m.id ? { ...m, start: isoAt(addDays(anchor, drag.day), drag.start) } : m))
            .filter((m) => dayOffset(m.start, d) === 0);
          const placed = lanes(here.map((m) => ({ id: m.id, start: minutesOf(m.start), dur: m.durationMin })));
          const today = dayOffset(d, now) === 0;
          return (
            <div
              key={d.toISOString()}
              className={classNames('act-wk-col', col > 4 && 'weekend', today && 'today')}
              data-col={col}
              style={{ height: HOURS * HOUR }}
              onPointerUp={(e) => { if (!dragRef.current) onSlot(e, d); }}
            >
              {here.map((m) => {
                const lane = placed.get(m.id) ?? { lane: 0, of: 1 };
                const start = minutesOf(m.start);
                const top = ((Math.max(DAY_START, start) - DAY_START) / 60) * HOUR;
                return (
                  <button
                    key={m.id}
                    type="button"
                    className={classNames('act-ev', m.durationMin < 45 && 'short', drag?.id === m.id && 'moving')}
                    data-testid="calendar-event"
                    style={{ ...hue(typeStyle(m.type).hue), '--l': lane.lane / lane.of, '--w': 1 / lane.of, top, height: Math.max(22, (m.durationMin / 60) * HOUR - 3) } as CSSProperties}
                    aria-label={`${m.title}, ${dayLabel(d)} ${hm(start)} to ${hm(start + m.durationMin)}`}
                    onPointerDown={(e) => onEventDown(e, m)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openCard(m, e.currentTarget); } }}
                  >
                    <b>{m.title}</b><small>{hm(start)}{m.durationMin >= 45 ? `–${hm(start + m.durationMin)}` : ''}</small>
                  </button>
                );
              })}
              {today && now.getHours() * 60 + now.getMinutes() >= DAY_START && now.getHours() * 60 + now.getMinutes() <= DAY_END && (
                <i className="act-wk-now" style={{ top: ((now.getHours() * 60 + now.getMinutes() - DAY_START) / 60) * HOUR }} />
              )}
            </div>
          );
        })}
      </div>
    </section>
  );

  const month = monthOf && (() => {
    const first = weekStart(monthOf);
    const cells = Array.from({ length: 42 }, (_, i) => addDays(first, i));
    return (
      <section className="card act-month" data-testid="calendar-month">
        <div className="act-mo-head">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div key={d}>{d}</div>)}</div>
        <div className="act-mo-grid">
          {cells.map((d) => {
            const ms = shown.filter((m) => dayOffset(m.start, d) === 0).sort((a, b) => a.start.localeCompare(b.start));
            return (
              <div key={d.toISOString()} className={classNames('act-mo-cell', d.getMonth() !== monthOf.getMonth() && 'out', dayOffset(d, now) === 0 && 'today')}>
                <span className="act-n">{d.getDate()}</span>
                {ms.slice(0, 3).map((m) => (
                  <button key={m.id} type="button" className="act-mo-ev" style={hue(typeStyle(m.type).hue)} onClick={(e) => openCard(m, e.currentTarget)}>
                    <i /><span>{hm(minutesOf(m.start))} {m.title}</span>
                  </button>
                ))}
                {ms.length > 3 && <button type="button" className="act-more" onClick={() => { setView('week'); setAnchor(weekStart(d)); }}>+{ms.length - 3} more</button>}
              </div>
            );
          })}
        </div>
      </section>
    );
  })();

  const agenda = (
    <section className="card act-agenda" data-testid="calendar-agenda">
      {days.map((d) => {
        const ms = shown.filter((m) => dayOffset(m.start, d) === 0).sort((a, b) => a.start.localeCompare(b.start));
        if (!ms.length) return null;
        return (
          <div key={d.toISOString()}>
            <div className={classNames('act-ag-day', dayOffset(d, now) === 0 && 'today')}>{relativeDay(d, now)}<small>{ms.length} {ms.length === 1 ? 'item' : 'items'}</small></div>
            {ms.map((m) => (
              <button key={m.id} type="button" className="act-ag-ev" style={hue(typeStyle(m.type).hue)} onClick={(e) => openCard(m, e.currentTarget)}>
                <time>{hm(minutesOf(m.start))}</time><i /><span><b>{m.title}</b><small>{spanLabel(m.durationMin)}{m.location ? ` · ${m.location}` : ''}</small></span>
              </button>
            ))}
          </div>
        );
      })}
      {days.every((d) => !shown.some((m) => dayOffset(m.start, d) === 0)) && <div className="act-cele"><b>A clear week</b>Nothing on the calendar.</div>}
    </section>
  );

  return (
    <div className="act3 act-cal" ref={wrap} data-testid="calendar-page">
      <div className="page-header">
        <div>
          <h1>Calendar</h1>
          <p className="page-subtitle">Meetings, calls and visits, with tasks on the days they are due.</p>
        </div>
        <div className="page-actions">
          <ToolBoxMenu links={ACTIVITY_TOOLBOX_LINKS} />
          {canManage && <button className="btn btn-primary contacts-primary" data-testid="new-meeting" onClick={() => navigate('/calendar/new')}><Plus size={16} /> New meeting</button>}
        </div>
      </div>

      <div className="act-calbar">
        <button type="button" className="btn" onClick={() => { setAnchor(weekStart(new Date())); setCard(null); }}>Today</button>
        <button type="button" className="btn acct-sq" aria-label={view === 'month' ? 'Previous month' : 'Previous week'} onClick={() => step(-1)}><ChevronLeft size={16} /></button>
        <button type="button" className="btn acct-sq" aria-label={view === 'month' ? 'Next month' : 'Next week'} onClick={() => step(1)}><ChevronRight size={16} /></button>
        <h2 aria-live="polite">{title}</h2>
        <span className="contact-tools-gap" />
        <TagPicker
          testId="calendar-people"
          label={<>{people.length === 1 && people[0] === user?.id ? 'My calendar' : people.length ? `People · ${people.length}` : 'Everyone'} <ChevronDown size={14} aria-hidden="true" /></>}
          tags={personChoices.map((u) => u.name)}
          selected={personChoices.filter((u) => people.includes(u.id)).map((u) => u.name)}
          onToggle={(name) => {
            const id = personChoices.find((u) => u.name === name)?.id;
            if (id) setPeople((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));
          }}
        />
        {!narrow && (
          <div className="seg contact-seg" role="group" aria-label="View">
            <button type="button" aria-pressed={view === 'week'} onClick={() => { setView('week'); setCard(null); }}>Week</button>
            <button type="button" aria-pressed={view === 'month'} onClick={() => { setView('month'); setCard(null); }}>Month</button>
          </div>
        )}
      </div>

      {loading ? <SkeletonRows rows={8} /> : failed ? (
        <div className="banner banner-error contacts-error" role="alert">
          <p>The calendar couldn’t load. Check your connection and try again.</p>
          <button type="button" className="btn" onClick={load}>Retry</button>
        </div>
      ) : narrow ? agenda : view === 'month' ? month : week}

      <div className="act-legend">
        {activityTypes().filter((t) => !/^(email|note)$/i.test(t)).map((t) => <span key={t}><i style={{ background: typeStyle(t).hue }} />{t}</span>)}
        {!narrow && canManage && view === 'week' && <em>Drag a meeting to move it. Click an empty slot to add one.</em>}
      </div>

      {cardMeeting && card && (
        <div className="act-evcard" role="dialog" aria-label={cardMeeting.title} style={{ left: card.x, top: card.y }} data-testid="meeting-card">
          <button type="button" className="act-x" aria-label="Close" onClick={() => setCard(null)}><X size={16} /></button>
          <span className="act-ty" style={hue(typeStyle(cardMeeting.type).hue)}><i />{cardMeeting.type}</span>
          <h3>{cardMeeting.title}</h3>
          <dl>
            <dt><Clock size={15} aria-hidden="true" /></dt>
            <dd>{relativeDay(new Date(cardMeeting.start), now)} · {hm(minutesOf(cardMeeting.start))}–{hm(minutesOf(cardMeeting.start) + cardMeeting.durationMin)} <span className="muted">({spanLabel(cardMeeting.durationMin)})</span></dd>
            {cardMeeting.location && <><dt><MapPin size={15} aria-hidden="true" /></dt><dd>{cardMeeting.location}</dd></>}
            <dt><Users size={15} aria-hidden="true" /></dt>
            <dd className="act-who">
              <span className="act-faces">{cardMeeting.attendeeIds.map((id) => <Face key={id} id={id} name={users.find((u) => u.id === id)?.name ?? '?'} small />)}</span>
              {cardMeeting.attendeeIds.map((id) => users.find((u) => u.id === id)?.name.split(' ')[0]).filter(Boolean).join(', ') || 'Nobody yet'}
            </dd>
            {findTarget(targets, cardMeeting.recordModule, cardMeeting.recordId) && (
              <><dt><Link2 size={15} aria-hidden="true" /></dt><dd><RecordChip {...findTarget(targets, cardMeeting.recordModule, cardMeeting.recordId)!} /></dd></>
            )}
          </dl>
          {canManage && (
            <div className="act-cardacts">
              <Link className="btn" to={`/calendar/${cardMeeting.id}/edit`}><Pencil size={14} /> Edit</Link>
              <Link className="btn btn-primary contacts-primary" data-testid="log-outcome" to={`/activity/new?meeting=${cardMeeting.id}`}><CheckCircle2 size={14} /> Log outcome</Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
