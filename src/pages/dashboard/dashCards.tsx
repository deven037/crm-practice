import { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowDownRight, ArrowUpRight, Calendar, Check, CheckSquare, Clock, FileText, Layers, List, Megaphone, Ticket as TicketIcon, TrendingUp } from 'lucide-react';
import { Activity, Deal, User } from '../../types';
import { classNames, timeAgo } from '../../utils';
import { money, moneyShort, plural } from '../quotes/quoteLogic';
import { Face, typeStyle } from '../activity/activityBits';
import { activityType } from '../activity/activityLogic';
import { DayItem, MonthSeries, NEED_KINDS, NeedItem, NeedKind, niceStep, TeamRow } from './dashLogic';

export const hue = (c: string) => ({ '--c': c }) as CSSProperties;

/** Shown in a card whose data did not load; the rest of the Dashboard keeps working. */
export function Unavailable({ what, onRetry }: { what: string; onRetry: () => void }) {
  return (
    <div className="dash-unavailable" data-testid={`dash-unavailable-${what}`}>
      <span>Couldn’t load {what}.</span>
      <button type="button" className="btn-link" onClick={onRetry}>Retry</button>
    </div>
  );
}

export function CardHead({ title, sub, children }: { title: string; sub?: ReactNode; children?: ReactNode }) {
  return (
    <div className="db-wh">
      <h2>{title}</h2>
      {sub && <span className="db-muted db-sub">{sub}</span>}
      {children}
    </div>
  );
}

// ---------- needs you ----------
const KIND_ICON: Record<NeedKind, typeof TicketIcon> = { ticket: TicketIcon, approval: FileText, meeting: Calendar, task: CheckSquare, deal: TrendingUp, campaign: Megaphone };

interface NeedsProps {
  items: NeedItem[];
  users: User[];
  showOwner: boolean;
  canAct: boolean;
  onDone: (item: NeedItem) => Promise<void> | void;
  onSnooze: (item: NeedItem) => void;
  controls?: ReactNode;
}

/** The most urgent things as a deck of cards: act on the top one, snooze it, or swipe it (right: act, left: snooze). */
export function NeedsCard({ items, users, showOwner, canAct, onDone, onSnooze, controls }: NeedsProps) {
  const navigate = useNavigate();
  const [kind, setKind] = useState<NeedKind | null>(null);
  const [list, setList] = useState(false);
  const [leaving, setLeaving] = useState<{ key: string; dir: 'r' | 'l' } | null>(null);
  const [dx, setDx] = useState(0);
  const swipe = useRef<{ x: number; key: string } | null>(null);
  const kinds = [...new Set(items.map((i) => i.kind))];
  const shown = items.filter((i) => !kind || i.kind === kind);
  const top = shown.slice(0, 3);

  const act = (item: NeedItem) => {
    if (item.taskId) {
      setLeaving({ key: item.key, dir: 'r' });
      window.setTimeout(() => { setLeaving(null); void onDone(item); }, 240);
    } else navigate(item.href);
  };
  const snooze = (item: NeedItem) => {
    setLeaving({ key: item.key, dir: 'l' });
    window.setTimeout(() => { setLeaving(null); onSnooze(item); }, 240);
  };

  const down = (item: NeedItem) => (e: ReactPointerEvent) => {
    if ((e.target as HTMLElement).closest('button, a')) return;
    swipe.current = { x: e.clientX, key: item.key };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const move = (e: ReactPointerEvent) => { if (swipe.current) setDx(e.clientX - swipe.current.x); };
  const up = (item: NeedItem) => () => {
    if (!swipe.current) return;
    swipe.current = null;
    const d = dx;
    setDx(0);
    if (d > 90 && canAct) act(item);
    else if (d < -90) snooze(item);
  };

  return (
    <div className="db-nd" data-testid="needs-you">
      <div className="db-nd-top">
        <h2>Needs you</h2>
        {items.length > 0 && <span className="db-nd-count" data-testid="needs-count">{items.length}</span>}
        {items.length > 0 && (
          <button type="button" className="btn btn-ghost db-nd-view" onClick={() => setList((l) => !l)}>
            {list ? <Layers size={15} aria-hidden="true" /> : <List size={15} aria-hidden="true" />}{list ? 'As cards' : 'As a list'}
          </button>
        )}
        {controls}
      </div>
      {kinds.length > 1 && (
        <div className="db-nd-kinds" role="group" aria-label="Show only">
          {kinds.map((k) => (
            <button key={k} type="button" aria-pressed={kind === k} style={hue(NEED_KINDS[k].hue)} onClick={() => setKind(kind === k ? null : k)}>
              <i />{NEED_KINDS[k].label} {items.filter((i) => i.kind === k).length}
            </button>
          ))}
        </div>
      )}
      {shown.length === 0 ? (
        <div className="db-nd-done">
          <Check size={32} aria-hidden="true" />
          <b>Nothing needs you</b>
          <span>{kind ? 'Nothing of this kind. Clear the filter to see the rest.' : 'Late tickets, approvals, overdue tasks and deals without a next step show here.'}</span>
        </div>
      ) : list ? (
        <div className="db-nd-list">
          {shown.map((i) => (
            <Link key={i.key} to={i.href} className="db-nd-row" style={hue(NEED_KINDS[i.kind].hue)}>
              <i /><span><b>{i.title}</b><small>{i.sub}</small></span><span className={classNames('db-when', i.hot && 'hot')}>{i.why}</span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="db-pile">
          {[...top].reverse().map((i) => {
            const depth = top.indexOf(i);
            const Icon = KIND_ICON[i.kind];
            const gone = leaving?.key === i.key ? `gone-${leaving.dir}` : '';
            const dragging = depth === 0 && dx !== 0 && !gone;
            return (
              <article key={i.key} className={classNames('db-dk', depth > 0 && `b${depth}`, gone, dragging && 'drag')} aria-hidden={depth > 0 || undefined}
                style={{ ...hue(NEED_KINDS[i.kind].hue), ...(dragging ? { transform: `translateX(${dx}px) rotate(${dx / 30}deg)` } : {}) }}
                onPointerDown={depth === 0 ? down(i) : undefined} onPointerMove={depth === 0 ? move : undefined} onPointerUp={depth === 0 ? up(i) : undefined}
                onPointerCancel={() => { swipe.current = null; setDx(0); }} data-testid={depth === 0 ? 'needs-top' : undefined}>
                {/* The cards underneath only show their edge, so they carry no content or buttons. */}
                {depth === 0 && (<>
                <div className="db-dk-k">
                  <span className="ico"><Icon size={15} aria-hidden="true" /></span>{NEED_KINDS[i.kind].label}
                  {showOwner && i.ownerId && <Face id={i.ownerId} name={users.find((u) => u.id === i.ownerId)?.name ?? ''} small />}
                  <span className="n">1 of {shown.length}</span>
                </div>
                <h3>{i.title}</h3>
                <div className={classNames('why', i.hot && 'hot')}>{i.why}</div>
                {i.fuse !== null && <div className="db-fuse"><i style={{ width: `${Math.round(i.fuse * 100)}%` }} /></div>}
                {i.sub && <div className="db-muted db-small">{i.sub}</div>}
                <div className="acts">
                  {i.taskId && canAct ? (
                    <button type="button" className="btn btn-primary contacts-primary" data-testid="needs-act" onClick={() => act(i)}>{i.action}</button>
                  ) : (
                    <Link to={i.href} className="btn btn-primary contacts-primary" data-testid="needs-act">{i.taskId ? 'Open task' : i.action}</Link>
                  )}
                  <button type="button" className="btn btn-ghost" data-testid="needs-snooze" onClick={() => snooze(i)}><Clock size={15} aria-hidden="true" /> Snooze</button>
                  <span className="hint">Swipe right: {i.taskId ? 'done' : 'open'} · left: snooze</span>
                </div>
                </>)}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** For a bank with no data yet: four first steps instead of an empty deck. */
export function GetStarted({ steps, controls }: { steps: { title: string; sub: string; to: string; done: boolean }[]; controls?: ReactNode }) {
  return (
    <div className="db-nd">
      <div className="db-nd-top"><h2>Get your bank going</h2><span className="db-muted db-small">{steps.filter((s) => s.done).length} of {steps.length}</span>{controls}</div>
      <div className="db-start">
        {steps.map((s) => (
          <Link key={s.title} to={s.to} className={classNames(s.done && 'ok')}>
            <span className="ck"><Check size={13} aria-hidden="true" /></span><span><b>{s.title}</b><small>{s.sub}</small></span>
          </Link>
        ))}
      </div>
    </div>
  );
}

// ---------- month so far ----------
/** Won this month by day against last month, with a fan from today to month end for open deals closing this month. */
export function MonthChart({ m, narrow }: { m: MonthSeries; narrow: boolean }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = narrow ? 340 : 640;
  const H = narrow ? 210 : 230;
  const pl = 52, pr = 14, pt = 14, pb = 26;
  const empty = m.best === 0 && m.lastMonth[m.lastMonth.length - 1] === 0;
  const top = Math.max(m.best, ...m.lastMonth, 1);
  const step = niceStep(top);
  const max = Math.ceil(top / step) * step;
  const x = (d: number) => pl + ((d - 1) / Math.max(1, m.days - 1)) * (W - pl - pr);
  const y = (v: number) => pt + (1 - v / max) * (H - pt - pb);
  const path = (arr: number[]) => arr.map((v, i) => `${i ? 'L' : 'M'}${x(i + 1).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  // Last month is drawn over this month's days, so a 31-day month ends on the last day here too.
  const last = Array.from({ length: m.days }, (_, i) => m.lastMonth[Math.min(m.lastMonth.length - 1, Math.round((i / Math.max(1, m.days - 1)) * (m.lastMonth.length - 1)))] ?? 0);
  const ticks: number[] = [];
  for (let v = 0; v <= max + step / 2; v += step) ticks.push(v);
  const xt = narrow ? [1, Math.ceil(m.days / 2), m.days] : [1, 8, 15, 22, m.days];
  const mon = m.monthName.slice(0, 3);
  const now = m.thisMonth[m.today - 1] ?? 0;

  const onMove = (e: ReactPointerEvent<SVGRectElement>) => {
    const r = e.currentTarget.ownerSVGElement!.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    setHover(Math.max(1, Math.min(m.days, Math.round(1 + ((px - pl) / (W - pl - pr)) * (m.days - 1)))));
  };

  return (
    <div className="db-mo-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Won in ${m.monthName} by day against last month`}>
        <defs><linearGradient id="dbMoFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--bank-ink)" stopOpacity=".22" /><stop offset="1" stopColor="var(--bank-ink)" stopOpacity="0" /></linearGradient></defs>
        <g className="grid">
          {ticks.map((v) => <g key={v}><line x1={pl} x2={W - pr} y1={y(v)} y2={y(v)} /><text x={pl - 8} y={y(v) + 4} textAnchor="end">{v ? moneyShort(v) : '0'}</text></g>)}
        </g>
        {xt.map((d, i) => <text key={d} x={x(d)} y={H - 6} textAnchor={i === xt.length - 1 ? 'end' : i ? 'middle' : 'start'}>{d} {mon}</text>)}
        {!empty && m.today < m.days && (
          <>
            <polygon className="cone" points={`${x(m.today)},${y(now)} ${x(m.days)},${y(m.best)} ${x(m.days)},${y(now)}`} />
            <path className="exp" d={`M${x(m.today)} ${y(now)} L${x(m.days)} ${y(m.expected)}`} />
          </>
        )}
        <path className="last" d={path(last)} />
        <path className="area" d={`${path(m.thisMonth)} L${x(m.today)} ${y(0)} L${x(1)} ${y(0)} Z`} />
        <path className="this" d={path(m.thisMonth)} />
        <circle className="ring" cx={x(m.today)} cy={y(now)} r="4" />
        <circle className="now" cx={x(m.today)} cy={y(now)} r="4.5" />
        {empty && (
          <>
            <text x={(pl + W - pr) / 2} y={H / 2 - 10} textAnchor="middle" className="em">No deals won yet this month</text>
            <text x={(pl + W - pr) / 2} y={H / 2 + 8} textAnchor="middle">The line climbs as deals close</text>
          </>
        )}
        {hover && <line className="hov" x1={x(hover)} x2={x(hover)} y1={pt} y2={H - pb} />}
        <rect x={pl} y={pt} width={W - pl - pr} height={H - pt - pb} fill="transparent" onPointerMove={onMove} onPointerLeave={() => setHover(null)} />
      </svg>
      {hover && (
        <div className="db-mo-tip" style={{ left: `${(x(hover) / W) * 100}%` }}>
          <b>{hover} {mon}</b>
          {hover <= m.today ? `This month ${moneyShort(m.thisMonth[hover - 1] ?? 0)}` : 'Still to come'}
          <span className="db-muted">Last month {moneyShort(last[hover - 1] ?? 0)}</span>
        </div>
      )}
    </div>
  );
}

export function MonthFigures({ m }: { m: MonthSeries }) {
  const change = m.lastAtToday ? (m.won - m.lastAtToday) / m.lastAtToday : null;
  return (
    <div className="db-mo-figs">
      <div data-testid="won-revenue"><small>Won so far</small><b>{money(m.won)}</b><small>{plural(m.wonDeals, 'deal')}</small></div>
      {change !== null && (
        <span className={classNames('db-vs', change < 0 && 'neg')}>
          {change < 0 ? <ArrowDownRight size={13} aria-hidden="true" /> : <ArrowUpRight size={13} aria-hidden="true" />}
          {Math.abs(Math.round(change * 100))}% vs day {m.today} last month
        </span>
      )}
      <div className="db-mo-exp">
        <small>Expected by month end</small>
        <b>{m.best > m.won ? moneyShort(m.expected) : '—'}</b>
        <small>{m.best > m.won ? `between ${moneyShort(m.won)} and ${moneyShort(m.best)}` : 'No open deals close this month'}</small>
      </div>
    </div>
  );
}

// ---------- pulse ----------
export interface PulseTile { testId: string; label: string; value: string; note: ReactNode; to: string; hue: string; series: number[]; flag?: boolean }

export function Spark({ series }: { series: number[] }) {
  if (series.length < 2 || series.every((v) => v === 0)) return <svg className="db-spark" aria-hidden="true" />;
  const W = 120, H = 30;
  const mn = Math.min(...series), mx = Math.max(...series);
  const pts = series.map((v, i) => [(i / (series.length - 1)) * W, H - ((v - mn) / (mx - mn || 1)) * (H - 4) - 2]);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const end = pts[pts.length - 1];
  return (
    <svg className="db-spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      <path className="a" d={`${d} L${W} ${H} L0 ${H} Z`} /><path className="l" d={d} vectorEffect="non-scaling-stroke" /><circle cx={end[0]} cy={end[1]} r="2.6" />
    </svg>
  );
}

export function PulseCard({ tiles }: { tiles: PulseTile[] }) {
  return (
    <div className="db-pulse" data-testid="pulse">
      {tiles.map((t, i) => (
        <Link key={t.testId} to={t.to} className="db-pt" style={{ ...hue(t.hue), animationDelay: `${i * 40}ms` }} data-testid={t.testId}>
          {t.flag && <i className="flag" title="Needs attention" />}
          <span className="db-lab">{t.label}</span>
          <b>{t.value}</b>
          {t.note}
          <Spark series={t.series} />
        </Link>
      ))}
    </div>
  );
}

export function Delta({ change, unit = 'vs the period before' }: { change: number | null; unit?: string }) {
  if (change === null) return <span className="db-d flat">Nothing to compare yet</span>;
  if (Math.abs(change) < 0.005) return <span className="db-d flat">Same as the period before</span>;
  return <span className={classNames('db-d', change > 0 ? 'up' : 'down')}>{change > 0 ? '▲' : '▼'} {Math.abs(Math.round(change * 100))}% {unit}</span>;
}

// ---------- your day ----------
export function DayList({ items, nowIndex, untimed, now = Date.now() }: { items: DayItem[]; nowIndex: number; untimed: number; now?: number }) {
  const t = new Date(now).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  if (!items.length) {
    return (
      <div className="db-empty-s"><b>A clear day</b>{untimed ? `${plural(untimed, 'task')} due today with no time set.` : 'Meetings and tasks with a time show here.'}</div>
    );
  }
  return (
    <>
      <div className="db-day">
        {items.map((it, i) => (
          <div key={it.key}>
            {i === nowIndex && <div className="db-nowline"><span>{t}</span><i /></div>}
            <Link to={it.href} className={classNames('db-dy', i < nowIndex && 'past', i === nowIndex && 'next')} style={hue(it.hue)}>
              <span className="tm">{it.time}</span><span className="dot" /><span><b>{it.title}</b><small>{it.sub}</small></span>
            </Link>
          </div>
        ))}
        {nowIndex >= items.length && <div className="db-nowline"><span>{t}</span><i /></div>}
      </div>
      {untimed > 0 && (
        <div className="db-day-foot"><CheckSquare size={15} aria-hidden="true" /><span>{plural(untimed, 'more task')} due today, no time set</span><Link to="/tasks?due=today" className="db-link">Open tasks</Link></div>
      )}
    </>
  );
}

// ---------- deals ----------
export function River({ rows, picked, onPick }: { rows: { name: string; hue: string; count: number; value: number }[]; picked: string | null; onPick: (name: string) => void }) {
  return (
    <div className="db-river" data-testid="deals-by-stage">
      {rows.map((r, i) => (
        <button key={r.name} type="button" className="db-rv" aria-pressed={picked === r.name}
          style={{ ...hue(r.hue), flexGrow: picked === null || picked === r.name ? Math.max(r.value, 1) : Math.max(r.value, 1) * 0.35, animationDelay: `${i * 70}ms` } as CSSProperties}
          title={`${r.name}: ${plural(r.count, 'deal')}, ${money(r.value)}`} onClick={() => onPick(r.name)}>
          <b>{moneyShort(r.value)}</b><small>{r.name}</small>
        </button>
      ))}
    </div>
  );
}

export function ClosingList({ deals, accountName }: { deals: Deal[]; accountName: (id: string | null) => string }) {
  if (!deals.length) return <div className="db-muted db-small db-pad">Nothing closing in this stage.</div>;
  return (
    <div className="db-close">
      {deals.map((d) => {
        const days = Math.round((new Date(d.closeDate).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86_400_000);
        return (
          <Link key={d.id} to={`/deals/${d.id}`} className="db-cl">
            <span><b>{d.name}</b><small>{[accountName(d.accountId), d.stage].filter(Boolean).join(' · ')}</small></span>
            <span className="r"><b>{moneyShort(d.amount)}</b><small className={classNames(days < 0 && 'db-late')}>{days < 0 ? `${plural(-days, 'day')} late` : days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`} · {d.probability}%</small></span>
          </Link>
        );
      })}
    </div>
  );
}

// ---------- leads ----------
export function Waffle({ squares, keyRows, focus, onFocus }: { squares: string[]; keyRows: { name: string; hue: string; count: number }[]; focus: string | null; onFocus: (name: string) => void }) {
  const hueOf = (n: string) => keyRows.find((k) => k.name === n)?.hue ?? '#8a93a6';
  const total = keyRows.reduce((t, k) => t + k.count, 0);
  return (
    <>
      <div className={classNames('db-waf', focus && 'focus')} role="img" aria-label="Leads by status, each square is one percent" data-testid="leads-by-status">
        {squares.map((n, i) => <i key={i} className={classNames(focus === n && 'on')} style={{ ...hue(hueOf(n)), animationDelay: `${i * 6}ms` }} />)}
      </div>
      <div className="db-waf-key">
        {keyRows.map((k) => (
          <button key={k.name} type="button" style={hue(k.hue)} aria-pressed={focus === k.name} onClick={() => onFocus(k.name)}>
            <i /><span>{k.name}</span><small>{total ? Math.round((k.count / total) * 100) : 0}%</small><b>{k.count}</b>
          </button>
        ))}
      </div>
    </>
  );
}

// ---------- team ----------
export function TeamTable({ rows, me }: { rows: TeamRow[]; me: string | undefined }) {
  const most = Math.max(...rows.map((r) => r.won), 1);
  return (
    <div className="db-tm" data-testid="team-table">
      <div className="db-tm-row head"><span /><span>Person</span><span>Won this month</span><span className="r">Open deals</span><span className="r">Open tasks</span></div>
      {rows.map((r, i) => (
        <div key={r.id} className={classNames('db-tm-row', r.id === me && 'me')}>
          <Face id={r.id} name={r.name} small />
          <span className="nm"><b>{r.name}{r.id === me ? ' (you)' : ''}</b><small>{plural(r.solved, 'ticket')} solved</small></span>
          <span className="db-tm-bar"><span className="t"><i style={{ width: `${(r.won / most) * 100}%`, animationDelay: `${i * 60}ms` }} /></span><b>{r.won ? moneyShort(r.won) : '—'}</b></span>
          <span className="r">{r.open ? moneyShort(r.open) : '—'}</span>
          <span className="r">{r.tasks}</span>
        </div>
      ))}
    </div>
  );
}

// ---------- recent activity ----------
const PAGE = 12;
export function Feed({ activities }: { activities: Activity[] }) {
  const [shown, setShown] = useState(PAGE);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => setShown(PAGE), [activities.length]);
  const onScroll = () => {
    const el = box.current;
    if (!el || shown >= activities.length) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 60) setShown((v) => v + PAGE);
  };
  return (
    <div className="db-feed" ref={box} onScroll={onScroll} tabIndex={0} aria-label="Recent activity, scrollable" data-testid="activity-feed">
      {activities.slice(0, shown).map((a) => {
        const st = typeStyle(activityType(a));
        const Icon = st.icon;
        return (
          <div key={a.id} className="db-fe" style={hue(st.hue)}>
            <span className="ico"><Icon size={15} aria-hidden="true" /></span>
            <span className="tx">{a.text}</span>
            <small>{timeAgo(a.when)}</small>
          </div>
        );
      })}
      {activities.length > 0 && shown >= activities.length && <div className="db-muted db-small db-caught">You're all caught up.</div>}
      {activities.length === 0 && <div className="db-empty-s"><b>Nothing yet</b>Calls, meetings, wins and new leads show here as your team works.</div>}
    </div>
  );
}

