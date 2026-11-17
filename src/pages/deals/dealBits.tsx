import { CSSProperties, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, ReactNode, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowLeftRight, Check, ChevronDown, Clock, Search, Trophy, XCircle } from 'lucide-react';
import { Account, Deal, DEAL_STAGES, User } from '../../types';
import { applyAssignmentRule, getStatusOptions } from '../../utils/rules';
import { Modal } from '../../components/Modal';
import { autoCloseDate, classNames, formatCurrency } from '../../utils';
import { accountInitials, industryHue, shortMoney } from '../accounts/accountBits';
import {
  bubbleSize, buildStages, chanceAfterMove, daysUntil, dueInfo, forecastBuckets, forecastMonth, isOpenStage, runwayX, RUNWAY_FROM, RUNWAY_TO,
  StageInfo, stageOf, total, weighted,
} from './dealLogic';

/** The bank's lost reasons. Banks edit this list in Setup like any status code. */
export const DEFAULT_LOST_REASONS = ['Price or rate too high', 'Chose another bank', 'Credit not approved', 'Customer stopped responding', 'Project cancelled', 'Timing, revisit next year', 'Missing documents'];

/**
 * The deal after a stage change: the chance follows the new stage (unless set by hand), a win or loss stamps
 * today as the close date, a loss keeps its reason, and Setup's assignment rules get their say.
 */
export function movedDeal(deal: Deal, target: StageInfo, stages: StageInfo[], reason = ''): Deal {
  const moved: Deal = {
    ...deal,
    stage: target.name,
    probability: chanceAfterMove(deal, target, stages),
    lostReason: target.kind === 'lost' ? reason : '',
  };
  const stamped = autoCloseDate(deal.stage, moved);
  const assignedTo = applyAssignmentRule('deals', stamped);
  return assignedTo ? { ...stamped, ownerId: assignedTo } : stamped;
}

/** The bank's stages, in its order, with colours and default chances (Setup, status codes). */
export const bankStages = (): StageInfo[] => buildStages(getStatusOptions('deals', 'stage', DEAL_STAGES));
export const lostReasons = (): string[] => getStatusOptions('deals', 'lostReason', DEFAULT_LOST_REASONS);

export const hueStyle = (hue: string) => ({ '--c': hue }) as CSSProperties;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const reduced = () => typeof window === 'undefined' || !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** A small ring showing the chance to win. */
export function ChanceRing({ value, size = 24, stroke = 3.5, hue, delay = 120 }: { value: number; size?: number; stroke?: number; hue?: string; delay?: number }) {
  const r = (size - stroke) / 2;
  const length = 2 * Math.PI * r;
  const o = size / 2;
  return (
    <svg className="deal-ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle cx={o} cy={o} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
      <circle
        cx={o} cy={o} r={r} fill="none" stroke={hue ?? 'var(--bank-ink)'} strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={length} strokeDashoffset={length * (1 - Math.max(0, Math.min(100, value)) / 100)} transform={`rotate(-90 ${o} ${o})`}
        style={{ '--len': length, animationDelay: `${delay}ms` } as CSSProperties}
      />
    </svg>
  );
}

/** The account's crest in the size used on deal cards. */
export function MiniCrest({ account }: { account?: Pick<Account, 'name' | 'industry'> }) {
  return (
    <span className="deal-crest" style={{ '--h': account ? industryHue(account.industry) : '#8a93a6' } as CSSProperties} aria-hidden="true">
      {account ? accountInitials(account.name) : '–'}
    </span>
  );
}

/** A short confetti burst from a point, for a deal that has just been won. Skipped when less motion is asked for. */
export function celebrate(x: number, y: number) {
  if (reduced() || typeof document === 'undefined') return;
  const brand = getComputedStyle(document.documentElement).getPropertyValue('--bank-primary').trim() || '#1d3a6e';
  const colours = ['#17936a', '#c98a12', '#2f6fe0', '#6d4fd6', '#d1478d', brand];
  for (let i = 0; i < 28; i++) {
    const bit = document.createElement('i');
    const angle = Math.random() * Math.PI * 2;
    const dist = 60 + Math.random() * 100;
    bit.className = 'deal-confetti';
    bit.style.cssText = `left:${x}px;top:${y}px;--dx:${Math.cos(angle) * dist}px;--dy:${Math.sin(angle) * dist + 50}px;--r:${Math.random() * 720 - 360}deg;background:${colours[i % colours.length]};animation-delay:${Math.random() * 90}ms`;
    document.body.appendChild(bit);
    window.setTimeout(() => bit.remove(), 1300);
  }
}

export interface PickOption {
  value: string;
  label: string;
  hue?: string;
  hint?: string;
  lead?: ReactNode;
}

/** A searchable single choice that opens under its button, for lists a bank can grow without limit. */
export function SearchPicker({ options, value, onPick, label, find, footer, testId, invalid }: {
  options: PickOption[]; value: string; onPick: (value: string) => void; label: string; find: string; footer?: string; testId?: string; invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrap = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    input.current?.focus();
    const onDown = (e: MouseEvent) => { if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); trigger.current?.focus(); } };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const chosen = options.find((o) => o.value === value);
  const q = query.trim().toLowerCase();
  const shown = q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;

  return (
    <div className="deal-picker" ref={wrap}>
      <button
        ref={trigger}
        type="button"
        className="deal-picker-trigger"
        aria-label={`${label}: ${chosen?.label ?? 'none'}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-invalid={invalid || undefined}
        data-testid={testId}
        onClick={() => { setQuery(''); setOpen((o) => !o); }}
      >
        {chosen?.lead}
        {chosen?.hue && <i className="deal-dot" style={hueStyle(chosen.hue)} />}
        <span className="deal-picker-label">{chosen?.label ?? 'Choose…'}</span>
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      {open && (
        <div className="deal-picker-pop" data-testid={testId ? `${testId}-list` : undefined}>
          <input ref={input} className="deal-picker-find" aria-label={find} placeholder={find} value={query} onChange={(e) => setQuery(e.target.value)} />
          <div role="listbox" aria-label={label}>
            {shown.length === 0 && <div className="deal-picker-none">Nothing matches.</div>}
            {shown.map((o) => (
              <button
                type="button"
                key={o.value}
                role="option"
                aria-selected={o.value === value}
                className="deal-picker-option"
                onClick={() => { onPick(o.value); setOpen(false); trigger.current?.focus(); }}
              >
                {o.lead}
                {o.hue && <i className="deal-dot" style={hueStyle(o.hue)} />}
                <span className="deal-picker-label">{o.label}</span>
                {o.hint && <small>{o.hint}</small>}
                {o.value === value && <Check size={15} className="deal-picker-tick" aria-hidden="true" />}
              </button>
            ))}
          </div>
          {footer && <div className="deal-picker-none">{footer}</div>}
        </div>
      )}
    </div>
  );
}

/** Asks why a deal was lost before it moves to a lost stage. Nothing changes if it is closed without choosing. */
export function LostReasonDialog({ deal, onCancel, onConfirm }: { deal: Deal; onCancel: () => void; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState('');
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const reasons = lostReasons().filter((r) => !q || r.toLowerCase().includes(q));
  return (
    <Modal
      title={`Mark ${deal.name} as lost?`}
      onClose={onCancel}
      footer={
        <>
          <button className="btn" onClick={onCancel}>Keep it open</button>
          <button className="btn btn-danger" data-testid="confirm-lost-btn" disabled={!reason} onClick={() => onConfirm(reason)}>
            <XCircle size={15} aria-hidden="true" /> Mark as lost
          </button>
        </>
      }
    >
      <div className="deal-lost">
        <p className="muted">Pick the reason.</p>
        <label className="deal-find">
          <Search size={16} aria-hidden="true" />
          <input aria-label="Find a reason" placeholder="Find a reason" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <div className="deal-reasons" role="radiogroup" aria-label="Reason">
          {reasons.length === 0 && <div className="muted deal-picker-none">No reason matches.</div>}
          {reasons.map((r) => (
            <button type="button" key={r} role="radio" aria-checked={reason === r} className="deal-reason" onClick={() => setReason(r)}>
              {r}
              {reason === r && <Check size={15} aria-hidden="true" />}
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}

// ---------- board ----------

export interface BoardProps {
  deals: Deal[];
  stages: StageInfo[];
  accounts: Account[];
  users: User[];
  canWrite: boolean;
  landedId: string | null;
  fresh: boolean;
  onMove: (deal: Deal, stage: StageInfo, point: { x: number; y: number }) => void;
}

const ownerInitials = (users: User[], id: string) => accountInitials(users.find((u) => u.id === id)?.name ?? '?');

function DealCard({ deal, stage, account, users, landed, delay, onOpen }: {
  deal: Deal; stage: StageInfo; account?: Account; users: User[]; landed: boolean; delay: number; onOpen: (e: ReactMouseEvent) => void;
}) {
  const due = dueInfo(deal);
  const owner = users.find((u) => u.id === deal.ownerId)?.name;
  return (
    <button
      type="button"
      className={classNames('deal-card', landed && 'land')}
      data-deal-id={deal.id}
      data-testid="deal-card"
      style={{ ...hueStyle(stage.hue), animationDelay: `${delay}ms` }}
      aria-label={`${deal.name}, ${account?.name ?? 'no account'}, ${formatCurrency(deal.amount)}, ${deal.probability}% chance. ${due.text}.`}
      onClick={onOpen}
    >
      <span className="deal-card-name">{deal.name}</span>
      <span className="deal-card-acc"><MiniCrest account={account} /><span>{account?.name ?? 'No account'}</span></span>
      <span className="deal-card-row">
        <span className="deal-card-amt">{shortMoney(deal.amount)}</span>
        <span className="deal-chance"><ChanceRing value={deal.probability} hue={stage.hue} delay={delay + 150} />{deal.probability}%</span>
      </span>
      <span className="deal-card-row deal-card-foot">
        <span className={classNames('deal-due', due.tone)}>{due.tone === 'late' ? <AlertTriangle size={13} aria-hidden="true" /> : <Clock size={13} aria-hidden="true" />}{due.text}</span>
        <i className="deal-owner" title={owner ? `Owner: ${owner}` : undefined}>{ownerInitials(users, deal.ownerId)}</i>
      </span>
    </button>
  );
}

function Bin({ stage, deals, fresh, delay, onOpen }: { stage: StageInfo; deals: Deal[]; fresh: boolean; delay: number; onOpen: (id: string) => void }) {
  const [all, setAll] = useState(false);
  const won = stage.kind === 'won';
  const list = [...deals].sort((a, b) => b.closeDate.localeCompare(a.closeDate));
  const shown = all ? list : list.slice(0, 3);
  return (
    <div className="deal-bin" data-drop={stage.name} data-testid={`deal-bin-${stage.kind}`} style={{ ...hueStyle(stage.hue), animationDelay: `${fresh ? delay : 0}ms` }}>
      <div className="deal-bin-h">
        <span className="deal-bin-icon">{won ? <Trophy size={17} aria-hidden="true" /> : <XCircle size={17} aria-hidden="true" />}</span>
        <div><b>{stage.name}</b><small>{plural(deals.length, 'deal')}</small></div>
        <span className="deal-bin-sum">{shortMoney(total(deals))}</span>
      </div>
      {shown.map((d) => (
        <button type="button" key={d.id} className="deal-mini" onClick={() => onOpen(d.id)}>
          <span>{d.name}{!won && <small>{d.lostReason || 'No reason given'}</small>}</span>
          <b>{shortMoney(d.amount)}</b>
        </button>
      ))}
      {list.length > 3 && (
        <button type="button" className="deal-link-btn" onClick={() => setAll((v) => !v)}>
          {all ? 'Show fewer' : `Show ${list.length - 3} more`}
        </button>
      )}
      <div className="deal-bin-hint">{won ? 'Drop a deal here to mark it won' : 'Drop a deal here to mark it lost'}</div>
    </div>
  );
}

/**
 * The pipeline board: open stages as chevron gates over lanes, the won and lost stages as drop bins on the right.
 * Cards are dragged with pointer events (mouse, pen and touch alike); the drag picture lives outside React.
 */
export function StageBoard({ deals, stages, accounts, users, canWrite, landedId, fresh, onMove }: BoardProps) {
  const navigate = useNavigate();
  const drag = useRef<{ id: string; el: HTMLElement; x: number; y: number; ox: number; oy: number; on: boolean; ghost?: HTMLElement; zone?: HTMLElement | null } | null>(null);
  const justDropped = useRef(false);
  const open = stages.filter((s) => s.kind === 'open');
  const wonStage = stages.find((s) => s.kind === 'won');
  const lostStage = stages.find((s) => s.kind === 'lost');
  const openTotal = total(deals.filter((d) => isOpenStage(d.stage)));
  const account = (id: string | null) => accounts.find((a) => a.id === id);

  useEffect(() => {
    const finish = (e: PointerEvent, drop: boolean) => {
      const d = drag.current;
      drag.current = null;
      if (!d || !d.on) return;
      justDropped.current = true;
      window.setTimeout(() => { justDropped.current = false; }, 0);
      d.ghost?.remove();
      d.el.classList.remove('lift');
      d.zone?.classList.remove('over');
      document.body.classList.remove('deal-dragging');
      const deal = deals.find((x) => x.id === d.id);
      const target = d.zone?.dataset.drop;
      if (drop && deal && target && target !== deal.stage) onMove(deal, stageOf(stages, target), { x: e.clientX, y: e.clientY });
    };
    const onMoveEvt = (e: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      if (!d.on) {
        if (Math.hypot(e.clientX - d.x, e.clientY - d.y) < 6) return;
        const rect = d.el.getBoundingClientRect();
        const ghost = d.el.cloneNode(true) as HTMLElement;
        ghost.classList.add('deal-drag-card');
        ghost.classList.remove('land');
        ghost.setAttribute('aria-hidden', 'true');
        ghost.style.width = `${rect.width}px`;
        document.body.appendChild(ghost);
        d.ox = d.x - rect.left;
        d.oy = d.y - rect.top;
        d.ghost = ghost;
        d.on = true;
        d.el.classList.add('lift');
        document.body.classList.add('deal-dragging');
      }
      if (!d.ghost) return;
      d.ghost.style.left = `${e.clientX - d.ox}px`;
      d.ghost.style.top = `${e.clientY - d.oy}px`;
      d.ghost.style.visibility = 'hidden';
      const zone = (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null)?.closest<HTMLElement>('[data-drop]') ?? null;
      d.ghost.style.visibility = '';
      if (zone !== d.zone) { d.zone?.classList.remove('over'); zone?.classList.add('over'); d.zone = zone; }
    };
    const onUp = (e: PointerEvent) => finish(e, true);
    const onCancel = (e: PointerEvent) => finish(e, false);
    window.addEventListener('pointermove', onMoveEvt);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    return () => {
      window.removeEventListener('pointermove', onMoveEvt);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
    };
  }, [deals, stages, onMove]);

  const onPointerDown = (e: ReactPointerEvent) => {
    if (!canWrite || e.button !== 0) return;
    const el = (e.target as HTMLElement).closest<HTMLElement>('.deal-card');
    if (!el?.dataset.dealId) return;
    drag.current = { id: el.dataset.dealId, el, x: e.clientX, y: e.clientY, ox: 0, oy: 0, on: false };
  };
  const openDeal = (id: string) => (e?: ReactMouseEvent) => {
    if (justDropped.current) { e?.preventDefault(); return; }
    navigate(`/deals/${id}`);
  };

  return (
    <>
      {canWrite && (
        <div className="deal-hint"><ArrowLeftRight size={14} aria-hidden="true" /> Drag a deal to another stage, or onto Won or Lost to close it. On a phone or with the keyboard, open the deal to move it.</div>
      )}
      <div className={classNames('deal-board', !fresh && 'still')} style={{ '--n': open.length } as CSSProperties} onPointerDown={onPointerDown} data-testid="deals-board">
        {open.map((stage, i) => {
          const inStage = deals.filter((d) => d.stage === stage.name).sort((a, b) => a.closeDate.localeCompare(b.closeDate));
          const sum = total(inStage);
          return (
            <div className="deal-col" key={stage.name}>
              <div className={classNames('deal-gate', i === 0 && 'first')} style={{ ...hueStyle(stage.hue), animationDelay: `${fresh ? i * 70 : 0}ms` }} data-testid="deal-gate">
                <small><i />{stage.name}</small>
                <b>{shortMoney(sum)}</b>
                <span>{plural(inStage.length, 'deal')} · {shortMoney(weighted(inStage))} weighted</span>
                <div className="deal-gate-meter"><i style={{ width: `${openTotal ? (sum / openTotal) * 100 : 0}%` }} /></div>
              </div>
              <div className="deal-lane" data-drop={stage.name} style={hueStyle(stage.hue)}>
                {inStage.length === 0 ? <div className="deal-lane-none">{canWrite ? 'No deals here. Drag one in.' : 'No deals here.'}</div> : inStage.map((deal, k) => (
                  <DealCard
                    key={deal.id}
                    deal={deal}
                    stage={stage}
                    account={account(deal.accountId)}
                    users={users}
                    landed={landedId === deal.id}
                    delay={fresh ? i * 70 + k * 45 + 120 : 0}
                    onOpen={openDeal(deal.id)}
                  />
                ))}
              </div>
            </div>
          );
        })}
        <div className="deal-col deal-bins">
          {wonStage && <Bin stage={wonStage} deals={deals.filter((d) => stageOf(stages, d.stage).kind === 'won')} fresh={fresh} delay={180} onOpen={(id) => openDeal(id)()} />}
          {lostStage && <Bin stage={lostStage} deals={deals.filter((d) => stageOf(stages, d.stage).kind === 'lost')} fresh={fresh} delay={240} onOpen={(id) => openDeal(id)()} />}
        </div>
      </div>
    </>
  );
}

/** On a phone the board becomes one stage at a time, picked from a row of stage tabs. */
export function PhoneBoard({ deals, stages, accounts, users, fresh }: Omit<BoardProps, 'onMove' | 'canWrite' | 'landedId'>) {
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const stage = stages[Math.min(index, stages.length - 1)];
  if (!stage) return null;
  const inStage = deals.filter((d) => d.stage === stage.name).sort((a, b) => (stage.kind === 'open' ? a.closeDate.localeCompare(b.closeDate) : b.closeDate.localeCompare(a.closeDate)));
  return (
    <div className="deal-phone" data-testid="deals-phone-board">
      <div className="deal-stabs" role="tablist" aria-label="Stages">
        {stages.map((s, i) => (
          <button key={s.name} type="button" role="tab" aria-selected={s.name === stage.name} style={hueStyle(s.hue)} onClick={() => setIndex(i)}>
            <i />{s.name}<span>{deals.filter((d) => d.stage === s.name).length}</span>
          </button>
        ))}
      </div>
      <div className="deal-gate flat" style={hueStyle(stage.hue)}>
        <small><i />{stage.name}</small>
        <b>{shortMoney(total(inStage))}</b>
        <span>{plural(inStage.length, 'deal')}{stage.kind === 'open' ? ` · ${shortMoney(weighted(inStage))} weighted` : ''}</span>
      </div>
      <div className={classNames('deal-plist', !fresh && 'still')}>
        {inStage.length === 0 ? <div className="card deal-empty-small">No deals in this stage.</div> : inStage.map((deal, k) => (
          <DealCard key={deal.id} deal={deal} stage={stage} account={accounts.find((a) => a.id === deal.accountId)} users={users} landed={false} delay={fresh ? k * 45 : 0} onOpen={() => navigate(`/deals/${deal.id}`)} />
        ))}
      </div>
      <p className="deal-phone-note">Open a deal to move it to another stage.</p>
    </div>
  );
}

// ---------- forecast runway ----------

export function ForecastCards({ deals, fresh }: { deals: Deal[]; fresh: boolean }) {
  const buckets = forecastBuckets(deals);
  const most = Math.max(1, ...buckets.map((b) => total(b.deals)));
  return (
    <div className={classNames('deal-fc', !fresh && 'still')} data-testid="deal-forecast">
      {buckets.map((b, i) => (
        <div key={b.key} className={classNames('card deal-fm', b.late && 'late')} style={{ animationDelay: `${fresh ? 200 + i * 60 : 0}ms` }}>
          <span className="deal-eyebrow">{b.label}</span>
          <b>{shortMoney(weighted(b.deals))}</b>
          <small>weighted, of {shortMoney(total(b.deals))} · {plural(b.deals.length, 'deal')}</small>
          <div className="deal-fbar"><i style={{ width: `${(total(b.deals) / most) * 100}%` }} /><i style={{ width: `${(weighted(b.deals) / most) * 100}%` }} /></div>
        </div>
      ))}
    </div>
  );
}

/** Every open deal as a bubble: across is the close date, up is the chance to win, size is the amount. */
export function Runway({ deals, stages, accounts, users, fresh }: { deals: Deal[]; stages: StageInfo[]; accounts: Account[]; users: User[]; fresh: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 380 });
  const [tip, setTip] = useState<string | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const top = 18;
  const bottom = 30;
  const y = (p: number) => top + (1 - p / 100) * (size.h - top - bottom);
  const x = (days: number) => runwayX(days) * size.w;
  const open = deals.filter((d) => isOpenStage(d.stage)).sort((a, b) => b.amount - a.amount);
  const largest = Math.max(1, ...open.map((d) => d.amount));
  const today = new Date();
  const months: { left: number; label: string }[] = [];
  for (let d = RUNWAY_FROM; d <= RUNWAY_TO; d++) {
    const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() + d);
    if (day.getDate() === 1) months.push({ left: x(d), label: day.toLocaleDateString('en-GB', { month: 'short' }) });
  }
  const tipDeal = open.find((d) => d.id === tip);
  const tipSize = tipDeal ? bubbleSize(tipDeal.amount, largest) : 0;
  const tipX = tipDeal ? x(daysUntil(tipDeal.closeDate)) : 0;
  const tipY = tipDeal ? y(tipDeal.probability) : 0;
  const below = tipY - tipSize / 2 < 130;

  return (
    <div className="card deal-runcard">
      <div className="deal-run" ref={box} data-testid="deals-runway" onMouseLeave={() => setTip(null)}>
        {[0, 25, 50, 75, 100].map((p) => <div key={p} className="deal-run-hl" style={{ top: y(p) }}><span>{p}%</span></div>)}
        <div className="deal-run-past" style={{ width: x(0) }}><span>Past close date</span></div>
        {months.map((m) => <div key={m.label + m.left} className="deal-run-vl" style={{ left: m.left }}><span>{m.label}</span></div>)}
        <div className="deal-run-now" style={{ left: x(0) }}><span>Today</span></div>
        {size.w > 0 && open.map((deal, k) => {
          const s = bubbleSize(deal.amount, largest);
          const stage = stageOf(stages, deal.stage);
          return (
            <Link
              key={deal.id}
              to={`/deals/${deal.id}`}
              className={classNames('deal-bub', !fresh && 'still')}
              data-testid="deal-bubble"
              aria-label={`${deal.name}, ${formatCurrency(deal.amount)}, ${deal.probability}% chance, ${dueInfo(deal).text}`}
              style={{ ...hueStyle(stage.hue), '--s': `${s}px`, left: x(daysUntil(deal.closeDate)), top: y(deal.probability), animationDelay: `${fresh ? 150 + k * 45 : 0}ms` } as CSSProperties}
              onMouseEnter={() => setTip(deal.id)}
              onFocus={() => setTip(deal.id)}
              onBlur={() => setTip(null)}
            >
              {s >= 44 && <span>{shortMoney(deal.amount)}</span>}
            </Link>
          );
        })}
        {tipDeal && (
          <div
            className={classNames('deal-tip', below && 'below')}
            role="tooltip"
            style={{ left: Math.min(size.w - 122, Math.max(122, tipX)), top: below ? tipY + tipSize / 2 + 10 : tipY - tipSize / 2 - 10 }}
          >
            <b>{tipDeal.name}</b>
            <span>{accounts.find((a) => a.id === tipDeal.accountId)?.name ?? 'No account'} · {users.find((u) => u.id === tipDeal.ownerId)?.name ?? 'No owner'}</span>
            <span className="deal-tip-row">
              <span className="deal-pill" style={hueStyle(stageOf(stages, tipDeal.stage).hue)}><i />{tipDeal.stage}</span>
              <b>{formatCurrency(tipDeal.amount)}</b>
            </span>
            <span className={classNames('deal-due', dueInfo(tipDeal).tone)}>{dueInfo(tipDeal).text} · {tipDeal.probability}% chance</span>
          </div>
        )}
      </div>
      <div className="deal-legend">
        {stages.filter((s) => s.kind === 'open').map((s) => <span key={s.name}><i style={{ background: s.hue }} />{s.name}</span>)}
        <em>Across: expected close date · Up: chance to win · Size: amount</em>
      </div>
    </div>
  );
}

/** On a phone the runway is a list of open deals grouped by close month. */
export function RunwayList({ deals, stages, accounts }: { deals: Deal[]; stages: StageInfo[]; accounts: Account[] }) {
  const buckets = forecastBuckets(deals).filter((b) => b.deals.length);
  if (!buckets.length) return <div className="card deal-empty-small">No open deals. Every deal here is closed.</div>;
  return (
    <div data-testid="deals-runway-list">
      {buckets.map((b) => (
        <div key={b.key} className="card deal-grp">
          <div className={classNames('deal-grp-h', b.late && 'late')}><b>{b.label}</b><span>{shortMoney(weighted(b.deals))} weighted of {shortMoney(total(b.deals))}</span></div>
          {[...b.deals].sort((a, c) => a.closeDate.localeCompare(c.closeDate)).map((d) => <DealRow key={d.id} deal={d} stages={stages} accounts={accounts} />)}
        </div>
      ))}
    </div>
  );
}

/** One deal as a compact row, used by the phone lists. */
export function DealRow({ deal, stages, accounts }: { deal: Deal; stages: StageInfo[]; accounts: Account[] }) {
  const due = dueInfo(deal);
  return (
    <Link className="deal-row" to={`/deals/${deal.id}`} style={hueStyle(stageOf(stages, deal.stage).hue)}>
      <span className="deal-dot" />
      <div><b>{deal.name}</b><small>{accounts.find((a) => a.id === deal.accountId)?.name ?? 'No account'} · {deal.stage} · {deal.probability}%</small></div>
      <div className="deal-row-r"><b>{shortMoney(deal.amount)}</b><small className={classNames('deal-due', due.tone)}>{due.short}</small></div>
    </Link>
  );
}

/** Beside the form: where the deal will sit on the runway, its weighted value and the month it counts toward. */
export function RunwayPreview({ amount, chance, closeDate, stage, stages, peers, largest }: { amount: number; chance: number; closeDate: string; stage: string; stages: StageInfo[]; peers: number; largest: number }) {
  const info = stageOf(stages, stage);
  const days = closeDate ? daysUntil(closeDate) : 30;
  const s = bubbleSize(amount, Math.max(largest, amount, 1), 14, 34);
  return (
    <aside className="card deal-preview" aria-label="Preview on the forecast runway" data-testid="deal-preview">
      <span className="deal-eyebrow">On the forecast runway</span>
      <div className="deal-mrun">
        <div className="deal-run-past" style={{ width: `${runwayX(0) * 100}%` }} />
        <div className="deal-run-now" style={{ left: `${runwayX(0) * 100}%` }}><span>Today</span></div>
        <i className="deal-bub still" style={{ ...hueStyle(info.hue), '--s': `${s}px`, left: `${runwayX(days) * 100}%`, top: `${10 + (1 - chance / 100) * 80}%` } as CSSProperties} />
        <span className="deal-mrun-ax">→ close date</span>
      </div>
      <div className="deal-pvs">
        <div><span>Weighted value</span><b>{shortMoney((Math.max(0, amount) * chance) / 100)}</b></div>
        <div><span>Counts toward</span><b>{forecastMonth(closeDate, stage)}</b></div>
      </div>
      <p className="muted">
        {info.kind === 'open' ? `Joins ${plural(peers, 'other open deal')} in ${stage}.` : `${stage} deals sit in the ${info.kind === 'won' ? 'Won' : 'Lost'} bin, outside the forecast.`}
      </p>
    </aside>
  );
}
