import { CSSProperties, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUp, Bell, Check, ChevronLeft, Minus, Pencil, Plus, Shuffle, X } from 'lucide-react';
import { apiFetch } from '../data/apiFetch';
import { getAllSync } from '../data/store';
import { SlaClock, SlaConfig, SlaRules, TicketPriority, TicketStatus, TICKET_DONE, TICKET_STATUSES, User } from '../types';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast';
import { useAuth } from '../auth/AuthContext';
import { classNames } from '../utils';
import { hoursText, PRIORITY_ORDER, priorityHue, staffOf, statusHue } from './tickets/ticketLogic';
import { PriorityMark } from './tickets/ticketBits';

interface Policy { configs: SlaConfig[]; rules: SlaRules }

/** The times a priority can promise, in hours. */
export const SLA_STEPS = [0.25, 0.5, 1, 2, 4, 8, 12, 24, 36, 48, 72, 120];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const AXIS: [number, string][] = [[0.25, '15 m'], [1, '1 h'], [4, '4 h'], [24, '1 d'], [72, '3 d']];
/** Position on a log scale from 10 minutes to 5 days. */
export const scaleX = (hours: number) => Math.max(0, Math.min(100, (Math.log((hours * 60) / 10) / Math.log(7200 / 10)) * 100));

/** Moves a value one step along SLA_STEPS (or to the nearest step when it sits between two). */
export function stepHours(value: number, by: 1 | -1): number {
  const i = SLA_STEPS.findIndex((s) => s >= value - 1e-9);
  const at = i < 0 ? SLA_STEPS.length - 1 : i;
  const exact = Math.abs(SLA_STEPS[at] - value) < 1e-9;
  const next = by > 0 ? (exact ? at + 1 : at) : at - 1;
  return SLA_STEPS[Math.max(0, Math.min(SLA_STEPS.length - 1, next))];
}

const ordered = (configs: SlaConfig[]) => PRIORITY_ORDER.map((p) => configs.find((c) => c.priority === p)).filter(Boolean) as SlaConfig[];
const same = (a: Policy | null, b: Policy | null) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Setup › SLA policies: how fast the bank promises to reply and to resolve for each priority, which clock each runs
 * on, when tickets escalate or get handed out, working hours, and which statuses pause the clock.
 */
export function SlaManagement() {
  const toast = useToast();
  const { user } = useAuth();
  const canEdit = user?.role === 'admin';
  // The order of these states is relied on by the page tests; add new ones at the end.
  const [saved, setSaved] = useState<Policy | null>(null);
  const [draft, setDraft] = useState<Policy | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [asking, setAsking] = useState(false);
  const [apply, setApply] = useState<'new' | 'all'>('new');
  const [busy, setBusy] = useState(false);
  const [bumped, setBumped] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const policy = await apiFetch<Policy>('/slaConfigs/policy');
        const clean = { configs: ordered(policy.configs), rules: policy.rules };
        setSaved(clean);
        setDraft(clean);
      } catch {
        setLoadError(true);
      }
    })();
  }, []);

  if (loadError) return <div className="banner banner-error" role="alert" data-testid="sla-load-error">SLA policies couldn’t load. Check your connection and reload the page.</div>;
  if (!draft || !saved) return <div className="tk3"><p className="tk-muted">Loading SLA policies…</p></div>;

  const dirty = !same(draft, saved);
  const staff = staffOf(getAllSync<User>('users'));
  const setRules = (patch: Partial<SlaRules>) => setDraft((d) => (d ? { ...d, rules: { ...d.rules, ...patch } } : d));
  const setConfig = (priority: TicketPriority, patch: Partial<SlaConfig>) => setDraft((d) => (d ? { ...d, configs: d.configs.map((c) => (c.priority === priority ? { ...c, ...patch } : c)) } : d));

  const step = (c: SlaConfig, key: 'firstReplyHours' | 'hours', by: 1 | -1) => {
    const next = stepHours(key === 'hours' ? c.hours : c.firstReplyHours ?? 1, by);
    if (key === 'firstReplyHours' && next >= c.hours) { toast.push('error', 'The first reply must come before the resolve time.'); return; }
    if (key === 'hours' && next <= (c.firstReplyHours ?? 0)) { toast.push('error', 'The resolve time must come after the first reply.'); return; }
    setConfig(c.priority, { [key]: next });
    setBumped(`${c.priority}-${key}`);
  };

  const save = async () => {
    setBusy(true);
    try {
      const { id: _id, ...rules } = draft.rules;
      const body = { configs: draft.configs.map((c) => ({ priority: c.priority, hours: c.hours, firstReplyHours: c.firstReplyHours ?? 1, clock: c.clock ?? '24x7' })), rules, apply };
      const result = await apiFetch<Policy & { moved: number }>('/slaConfigs/policy', { method: 'PUT', body: JSON.stringify(body) });
      const clean = { configs: ordered(result.configs), rules: result.rules };
      setSaved(clean);
      setDraft(clean);
      setAsking(false);
      toast.push('success', apply === 'all' ? `SLA policy saved. ${result.moved} open ${result.moved === 1 ? 'ticket' : 'tickets'} recalculated.` : 'SLA policy saved. It applies to new tickets.');
    } catch (e) {
      toast.push('error', (e as Error)?.message || 'The SLA policy couldn’t be saved. Your changes are still here; try again.');
    }
    setBusy(false);
  };

  const pausable = TICKET_STATUSES.filter((s) => !TICKET_DONE.includes(s) && !draft.rules.pauseStatuses.includes(s));

  return (
    <div className="tk3 tk-sla" data-testid="sla-page">
      <Link to="/tickets" className="contact-back"><ChevronLeft size={16} aria-hidden="true" /> Tickets</Link>
      <div className="page-header">
        <div>
          <h1>SLA policies</h1>
          <p className="tk-sub">How fast the bank promises to reply and to resolve, for each priority.</p>
        </div>
        {canEdit && (
          <div className="page-actions">
            {dirty && <span className="tk-unsaved" data-testid="sla-unsaved"><Pencil size={13} aria-hidden="true" />Unsaved changes</span>}
            {dirty && <button type="button" className="btn btn-ghost" onClick={() => setDraft(saved)} data-testid="sla-discard">Discard</button>}
            <button type="button" className="btn btn-primary contacts-primary" disabled={!dirty || busy} onClick={() => setAsking(true)} data-testid="sla-save">
              <Check size={15} aria-hidden="true" /> Save policy
            </button>
          </div>
        )}
      </div>
      {!canEdit && <p className="act-viewonly">View only. An admin changes the SLA policy.</p>}

      <section className="tk-card tk-ladder" aria-label="Promise per priority">
        <div className="tk-lrow head"><span>Priority</span><span>First reply</span><span>Resolve</span><span>On a 5 day scale</span><span>Clock</span></div>
        {draft.configs.map((c, i) => {
          const key = c.priority.toLowerCase();
          const clock: SlaClock = c.clock ?? '24x7';
          return (
            <div key={c.priority} className="tk-lrow" style={{ '--c': priorityHue(c.priority), animationDelay: `${i * 50}ms` } as CSSProperties} data-testid={`sla-row-${key}`}>
              <PriorityMark priority={c.priority} />
              <div className="tk-stepper">
                <button type="button" disabled={!canEdit} aria-label={`Shorter first reply for ${c.priority}`} data-testid={`sla-first-${key}-less`} onClick={() => step(c, 'firstReplyHours', -1)}><Minus size={14} /></button>
                <span key={bumped === `${c.priority}-firstReplyHours` ? 'b' : 'a'} className={classNames(bumped === `${c.priority}-firstReplyHours` && 'bump')} data-testid={`sla-first-${key}`}>{hoursText(c.firstReplyHours ?? 1)}</span>
                <button type="button" disabled={!canEdit} aria-label={`Longer first reply for ${c.priority}`} data-testid={`sla-first-${key}-more`} onClick={() => step(c, 'firstReplyHours', 1)}><Plus size={14} /></button>
              </div>
              <div className="tk-stepper">
                <button type="button" disabled={!canEdit} aria-label={`Shorter resolve time for ${c.priority}`} data-testid={`sla-hours-${key}-less`} onClick={() => step(c, 'hours', -1)}><Minus size={14} /></button>
                <span key={bumped === `${c.priority}-hours` ? 'b' : 'a'} className={classNames(bumped === `${c.priority}-hours` && 'bump')} data-testid={`sla-hours-${key}`}>{hoursText(c.hours)}</span>
                <button type="button" disabled={!canEdit} aria-label={`Longer resolve time for ${c.priority}`} data-testid={`sla-hours-${key}-more`} onClick={() => step(c, 'hours', 1)}><Plus size={14} /></button>
              </div>
              <div className="tk-scale" aria-hidden="true">
                <span className="rs" style={{ width: `${scaleX(c.hours)}%` }} />
                <span className="fs" style={{ width: `${scaleX(c.firstReplyHours ?? 1)}%` }} />
                {AXIS.map(([h]) => <i key={h} className="gl" style={{ left: `${scaleX(h)}%` }} />)}
                <div className="axis">{AXIS.map(([h, l]) => <span key={h} style={{ left: `${scaleX(h)}%` }}>{l}</span>)}</div>
              </div>
              <div className="tk-clocksel" role="group" aria-label={`Clock for ${c.priority}`}>
                <button type="button" disabled={!canEdit} aria-pressed={clock === '24x7'} title="Round the clock" onClick={() => setConfig(c.priority, { clock: '24x7' })} data-testid={`sla-clock-${key}-24x7`}>24/7</button>
                <button type="button" disabled={!canEdit} aria-pressed={clock === 'working'} onClick={() => setConfig(c.priority, { clock: 'working' })} data-testid={`sla-clock-${key}-working`}>Working hours</button>
              </div>
            </div>
          );
        })}
      </section>

      <div className="tk-scols">
        <section className="tk-card tk-box" aria-label="Escalation">
          <h2>Escalation</h2>
          <div className="tk-rule" style={{ '--c': '#d9a21a' } as CSSProperties}>
            <span className="tk-ri"><Bell size={16} aria-hidden="true" /></span>
            <p>When <span className="tk-inl">
              <button type="button" disabled={!canEdit} aria-label="Warn earlier" onClick={() => setRules({ warnPercent: Math.max(50, draft.rules.warnPercent - 5) })}><Minus size={12} /></button>
              <span data-testid="sla-warn">{draft.rules.warnPercent}%</span>
              <button type="button" disabled={!canEdit} aria-label="Warn later" onClick={() => setRules({ warnPercent: Math.min(95, draft.rules.warnPercent + 5) })}><Plus size={12} /></button>
            </span> of the time is used, tell the bank in notifications<br /><small>The ticket also turns amber in the queue at this point</small></p>
            <button type="button" className="tk-sw" role="switch" aria-checked={draft.rules.notifyOnWarn} aria-label="Warning on or off" disabled={!canEdit} onClick={() => setRules({ notifyOnWarn: !draft.rules.notifyOnWarn })} />
          </div>
          <div className="tk-rule" style={{ '--c': '#d33a3a' } as CSSProperties}>
            <span className="tk-ri"><ArrowUp size={16} aria-hidden="true" /></span>
            <div className="tk-rule-b">
              <p>On breach, escalate to <b>level 1</b><br /><small>The ticket gets a red badge on everyone’s queue</small></p>
              <select className="input tk-sel" disabled={!canEdit} aria-label="Level 1 person" value={draft.rules.level1UserId ?? ''} onChange={(e) => setRules({ level1UserId: e.target.value || null })}>
                <option value="">Team lead</option>
                {staff.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <button type="button" className="tk-sw" role="switch" aria-checked={draft.rules.escalateOnBreach} aria-label="Escalate on breach on or off" disabled={!canEdit} onClick={() => setRules({ escalateOnBreach: !draft.rules.escalateOnBreach })} />
          </div>
          <div className="tk-rule" style={{ '--c': '#d33a3a' } as CSSProperties}>
            <span className="tk-ri"><ArrowUp size={16} aria-hidden="true" /></span>
            <div className="tk-rule-b">
              <p><span className="tk-inl">
                <button type="button" disabled={!canEdit} aria-label="Sooner" onClick={() => setRules({ level2AfterMinutes: Math.max(30, draft.rules.level2AfterMinutes - 30) })}><Minus size={12} /></button>
                <span data-testid="sla-level2-after">{hoursText(draft.rules.level2AfterMinutes / 60)}</span>
                <button type="button" disabled={!canEdit} aria-label="Later" onClick={() => setRules({ level2AfterMinutes: Math.min(2880, draft.rules.level2AfterMinutes + 30) })}><Plus size={12} /></button>
              </span> after the breach, escalate to <b>level 2</b></p>
              <select className="input tk-sel" disabled={!canEdit} aria-label="Level 2 person" value={draft.rules.level2UserId ?? ''} onChange={(e) => setRules({ level2UserId: e.target.value || null })}>
                <option value="">Service manager</option>
                {staff.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <button type="button" className="tk-sw" role="switch" aria-checked={draft.rules.level2} aria-label="Level 2 on or off" disabled={!canEdit} onClick={() => setRules({ level2: !draft.rules.level2 })} />
          </div>
          <div className="tk-rule" style={{ '--c': '#2f6fe0' } as CSSProperties}>
            <span className="tk-ri"><Shuffle size={16} aria-hidden="true" /></span>
            <p>Unassigned for <span className="tk-inl">
              <button type="button" disabled={!canEdit} aria-label="Sooner" onClick={() => setRules({ autoAssignMinutes: Math.max(15, draft.rules.autoAssignMinutes - 15) })}><Minus size={12} /></button>
              <span data-testid="sla-auto-assign">{hoursText(draft.rules.autoAssignMinutes / 60)}</span>
              <button type="button" disabled={!canEdit} aria-label="Later" onClick={() => setRules({ autoAssignMinutes: Math.min(1440, draft.rules.autoAssignMinutes + 15) })}><Plus size={12} /></button>
            </span>, give it to the person with the fewest open tickets</p>
            <button type="button" className="tk-sw" role="switch" aria-checked={draft.rules.autoAssign} aria-label="Auto assign on or off" disabled={!canEdit} onClick={() => setRules({ autoAssign: !draft.rules.autoAssign })} />
          </div>
        </section>

        <div className="tk-stack">
          <section className="tk-card tk-box" aria-label="Working hours">
            <h2>Working hours</h2>
            <div className="tk-week">
              {DAYS.map((d, i) => {
                const on = draft.rules.workingDays.includes(i);
                return (
                  <button key={d} type="button" className={classNames('tk-wd', !on && 'off')} aria-pressed={on} disabled={!canEdit}
                    onClick={() => setRules({ workingDays: on ? draft.rules.workingDays.filter((x) => x !== i) : [...draft.rules.workingDays, i].sort() })}>
                    <b>{d}</b><small>{on ? `${draft.rules.workFrom.slice(0, 2)}–${draft.rules.workTo.slice(0, 2)}` : 'closed'}</small>
                  </button>
                );
              })}
            </div>
            <div className="tk-hours">
              <label>From <input type="time" className="input" disabled={!canEdit} value={draft.rules.workFrom} onChange={(e) => setRules({ workFrom: e.target.value })} /></label>
              <label>To <input type="time" className="input" disabled={!canEdit} value={draft.rules.workTo} onChange={(e) => setRules({ workTo: e.target.value })} /></label>
              <label>Time zone <input className="input" disabled={!canEdit} value={draft.rules.timeZone} onChange={(e) => setRules({ timeZone: e.target.value })} /></label>
            </div>
            <p className="tk-muted tk-small">Working-hour clocks skip the hours and days outside these.</p>
          </section>
          <section className="tk-card tk-box" aria-label="Pausing the clock">
            <h2>Pause the clock when status is</h2>
            <div className="tk-ptags">
              {draft.rules.pauseStatuses.map((s) => (
                <span key={s} className="tk-ptag" style={{ '--c': statusHue(s) } as CSSProperties}>{s}
                  {canEdit && <button type="button" aria-label={`Stop pausing on ${s}`} onClick={() => setRules({ pauseStatuses: draft.rules.pauseStatuses.filter((x) => x !== s) })}><X size={12} /></button>}
                </span>
              ))}
              {draft.rules.pauseStatuses.length === 0 && <span className="tk-muted">No status pauses the clock.</span>}
              {canEdit && pausable.length > 0 && (
                <select className="input tk-sel tk-addt" aria-label="Add a status that pauses the clock" value="" onChange={(e) => e.target.value && setRules({ pauseStatuses: [...draft.rules.pauseStatuses, e.target.value as TicketStatus] })}>
                  <option value="">+ Add status</option>
                  {pausable.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              )}
            </div>
          </section>
        </div>
      </div>

      {asking && (
        <Modal
          title="Save SLA policy"
          onClose={() => setAsking(false)}
          footer={
            <>
              <button type="button" className="btn" onClick={() => setAsking(false)}>Cancel</button>
              <button type="button" className="btn btn-primary contacts-primary" disabled={busy} onClick={save} data-testid="sla-confirm-save"><Check size={15} aria-hidden="true" /> Save policy</button>
            </>
          }
        >
          <p>What should happen to tickets already open?</p>
          <div className="tk-apply">
            <label><input type="radio" name="sla-apply" checked={apply === 'new'} onChange={() => setApply('new')} data-testid="sla-apply-new" /><span>Keep their due times<small>The new rules apply to new tickets only</small></span></label>
            <label><input type="radio" name="sla-apply" checked={apply === 'all'} onChange={() => setApply('all')} data-testid="sla-apply-all" /><span>Recalculate them<small>Due times of open tickets move to the new rules</small></span></label>
          </div>
        </Modal>
      )}
    </div>
  );
}
