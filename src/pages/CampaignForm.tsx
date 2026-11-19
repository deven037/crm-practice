import { CSSProperties, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CalendarRange, ChevronLeft, Flag, Play } from 'lucide-react';
import { apiFetch } from '../data/apiFetch';
import { getAll, getAllSync, upsert } from '../data/store';
import { Campaign, CustomFieldDef, Deal, Lead, PageLayout, User } from '../types';
import { CustomFieldsSection, CustomFieldValues, validateCustomFields } from '../components/CustomFieldsSection';
import { useToast } from '../components/Toast';
import { useAuth } from '../auth/AuthContext';
import { SearchPicker } from './deals/dealBits';
import { Face } from './activity/activityBits';
import { dayText, money, moneyShort, plural } from './quotes/quoteLogic';
import {
  averageCpl, CampaignStats, campaignChannels, channelHue, DAY, dayIso, dayOffset, daysFromInput, inputDate, overlapping, pctOn,
  runWindow, startOfDay, statsFor,
} from './campaigns/campaignLogic';
import { ChannelBadge, hue } from './campaigns/campaignBits';

const DEFAULT_START = 14;
const DEFAULT_LENGTH = 42;

/**
 * New campaign and Edit campaign, as a full page. The run is set by dragging either end (or the whole run) on a
 * strip of months that also shows the other campaigns on the channel; the preview beside the form works out the
 * planned cost per lead and compares it with the channel and the bank.
 */
export function CampaignForm({ existing }: { existing?: Campaign } = {}) {
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const [params] = useSearchParams();
  const all = getAllSync<Campaign>('campaigns');
  const source = existing ?? all.find((c) => c.id === params.get('copy'));
  const copying = !existing && !!source;
  const layouts = getAllSync<PageLayout>('pageLayouts').filter((l) => l.module === 'campaigns');
  const layout = (existing ? layouts.find((l) => l.name === existing.layoutName) : undefined)
    ?? layouts.find((l) => l.id === params.get('layout')) ?? (source ? layouts.find((l) => l.name === source.layoutName) : undefined)
    ?? layouts.find((l) => l.isDefault) ?? layouts[0];
  const customIds = new Set(getAllSync<CustomFieldDef>('customFieldDefs').filter((d) => d.module === 'campaigns').map((d) => d.id));
  const layoutCustomIds = layout?.tabs ? layout.tabs.flatMap((t) => t.fieldKeys).filter((k) => customIds.has(k)) : undefined;
  const users = getAllSync<User>('users').filter((u) => u.active !== false && u.role !== 'viewer');
  const sourceLength = source ? Math.max(0, dayOffset(source.endDate) - dayOffset(source.startDate)) : DEFAULT_LENGTH;

  // One state per field; add new states at the end.
  const [name, setName] = useState(existing ? existing.name : source ? `${source.name} (copy)` : '');
  const [channel, setChannel] = useState(source?.channel ?? '');
  const [ownerId, setOwnerId] = useState(source?.ownerId ?? user?.id ?? '');
  const [audience, setAudience] = useState(source?.audience ?? '');
  const [startDay, setStartDay] = useState(existing ? dayOffset(existing.startDate) : copying ? 30 : DEFAULT_START);
  const [endDay, setEndDay] = useState(existing ? dayOffset(existing.endDate) : (copying ? 30 : DEFAULT_START) + sourceLength);
  const [budgetText, setBudgetText] = useState(source ? String(source.budget) : '');
  const [targetText, setTargetText] = useState(source?.targetLeads ? String(source.targetLeads) : '');
  const [errors, setErrors] = useState<{ name?: string; channel?: string; budget?: string; run?: string }>({});
  const [customFields, setCustomFields] = useState<CustomFieldValues>(source?.customFields ?? {});
  const [customErrors, setCustomErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [stats, setStats] = useState<Map<string, CampaignStats>>(new Map());

  useEffect(() => {
    // Leads and deals give the cost per lead the preview compares with; the form works without them.
    let alive = true;
    Promise.all([getAll<Lead>('leads'), getAll<Deal>('deals')]).then(([l, d]) => {
      if (alive) setStats(new Map(all.map((c) => [c.id, statsFor(c, l, d)])));
    }, () => undefined);
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const budget = Number(budgetText);
  const target = Math.round(Number(targetText));
  const plannedCpl = budget > 0 && target > 0 ? budget / target : null;
  const skip = existing?.id ?? null;
  const channelCpl = channel ? averageCpl(all, stats, channel, skip) : null;
  const bankCpl = averageCpl(all, stats, undefined, skip);
  const most = Math.max(plannedCpl ?? 0, channelCpl ?? 0, bankCpl ?? 0, 1);
  const overlaps = overlapping(all, channel, startDay, endDay, skip);
  const backTo = existing ? `/campaigns/${existing.id}` : '/campaigns';
  const channels = [...new Set([...campaignChannels(), ...(channel ? [channel] : [])])];
  const col = channel ? channelHue(channel) : '#8a93a6';
  const finished = existing && (existing.status === 'Completed' || existing.status === 'Cancelled');

  const setRun = (s: number, e: number) => {
    setStartDay(s);
    setEndDay(Math.max(e, s));
    setErrors((x) => ({ ...x, run: undefined }));
  };

  const submit = async () => {
    const errs: typeof errors = {};
    if (!name.trim()) errs.name = 'Give the campaign a name.';
    if (!channel) errs.channel = 'Pick a channel.';
    if (!budgetText.trim() || !Number.isFinite(budget) || budget <= 0) errs.budget = 'Enter a valid budget greater than 0.';
    if (endDay < startDay) errs.run = 'The end must be on or after the start.';
    setErrors(errs);
    const cErrs = validateCustomFields('campaigns', 'form', customFields, layoutCustomIds);
    setCustomErrors(cErrs);
    if (Object.keys(errs).length > 0 || Object.keys(cErrs).length > 0) return;

    const body = {
      name: name.trim(),
      channel,
      budget: Math.round(budget),
      startDate: dayIso(startDay),
      endDate: dayIso(endDay, true),
      ownerId: ownerId || null,
      audience: audience.trim(),
      targetLeads: target > 0 ? target : null,
      layoutName: existing ? existing.layoutName ?? null : layout?.name ?? null,
      customFields,
    };
    setBusy(true);
    try {
      if (existing) {
        // The server keeps spend and history, and moves a planned campaign to running when its start is now past.
        const saved = await upsert<Campaign>('campaigns', { ...existing, ...body });
        toast.push('success', saved.status !== existing.status ? `Changes saved. It is now ${saved.status}.` : 'Changes saved.');
        navigate(`/campaigns/${saved.id}`);
      } else {
        const saved = await apiFetch<Campaign>('/campaigns', { method: 'POST', body: JSON.stringify(body) });
        toast.push('success', saved.status === 'Planned' ? `${saved.name} planned. It starts on ${dayText(saved.startDate)}.` : `${saved.name} created and running.`);
        navigate(`/campaigns/${saved.id}`);
      }
    } catch {
      toast.push('error', existing ? 'The changes couldn’t be saved. Try again.' : 'Could not create the campaign. Try again.');
      setBusy(false);
    }
  };

  return (
    <div className="deal3 pq3 cp3 pq-form-page" data-testid="campaign-form-page">
      <Link to={backTo} className="contact-back"><ChevronLeft size={16} aria-hidden="true" /> {existing ? existing.name : 'Campaigns'}</Link>
      <div className="deal-fcols pq-fcols">
        <div className="card deal-formcard">
          <div className="acct-fhead">
            <h1>{existing ? `Edit ${existing.name}` : 'New campaign'}</h1>
            <p>{layout ? `Layout: ${layout.name}` : 'Plan the run, the money and the leads you want from it.'}</p>
          </div>

          <div className="pq-sect">
            <h2>Basics</h2>
            <div className="form-grid">
              <div className="field field-span">
                <label className="field-label" htmlFor="campaign-name-input">Name *</label>
                <input id="campaign-name-input" className="input" data-testid="campaign-name" value={name} placeholder="For example, Festive Business Loans"
                  aria-invalid={errors.name ? true : undefined} onChange={(e) => { setName(e.target.value); setErrors((x) => ({ ...x, name: undefined })); }} />
                {errors.name && <span className="field-error">{errors.name}</span>}
              </div>
              <div className="field">
                <span className="field-label">Channel *</span>
                <SearchPicker label="Channel" find="Find a channel" testId="campaign-channel" value={channel} invalid={!!errors.channel}
                  options={channels.map((ch) => {
                    const avg = averageCpl(all, stats, ch, skip);
                    return { value: ch, label: ch, hue: channelHue(ch), hint: avg ? `${moneyShort(avg)} per lead` : undefined };
                  })}
                  onPick={(v) => { setChannel(v); setErrors((x) => ({ ...x, channel: undefined })); }} />
                {errors.channel && <span className="field-error">{errors.channel}</span>}
              </div>
              <div className="field">
                <span className="field-label">Owner</span>
                <SearchPicker label="Owner" find="Find a person" testId="campaign-owner" value={ownerId}
                  options={users.map((u) => ({ value: u.id, label: u.name, lead: <Face id={u.id} name={u.name} small /> }))}
                  onPick={setOwnerId} />
              </div>
              <div className="field field-span">
                <label className="field-label" htmlFor="campaign-audience-input">Who it is for</label>
                <textarea id="campaign-audience-input" className="input tk-ta" data-testid="campaign-audience" value={audience} maxLength={1000}
                  placeholder="For example, SME owners in Pune with a current account elsewhere" onChange={(e) => setAudience(e.target.value)} />
              </div>
            </div>
          </div>

          <div className="pq-sect">
            <h2>Run</h2>
            <p className="pq-muted pq-small cp-h-sub">Drag either end on the strip, or the whole run, or use the arrow keys on an end (Shift moves a week). The thin lines are other {channel ? `${channel} ` : ''}campaigns.</p>
            <SeasonStrip campaigns={all.filter((c) => c.id !== skip && c.status !== 'Cancelled' && (!channel || c.channel === channel))}
              start={startDay} end={endDay} color={col} onChange={setRun} />
            <div className="form-grid">
              <div className="field">
                <label className="field-label" htmlFor="campaign-start-input">Starts</label>
                <input id="campaign-start-input" type="date" className="input" data-testid="campaign-start-date" value={inputDate(startDay)}
                  onChange={(e) => { const d = daysFromInput(e.target.value); if (d !== null) setRun(d, Math.max(d, endDay)); }} />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="campaign-end-input">Ends</label>
                <input id="campaign-end-input" type="date" className="input" data-testid="campaign-end-date" value={inputDate(endDay)}
                  aria-invalid={errors.run ? true : undefined}
                  onChange={(e) => { const d = daysFromInput(e.target.value); if (d !== null) setRun(Math.min(startDay, d), d); }} />
                {errors.run && <span className="field-error">{errors.run}</span>}
              </div>
            </div>
          </div>

          <div className="pq-sect">
            <h2>Money and goal</h2>
            <div className="form-grid">
              <div className="field">
                <label className="field-label" htmlFor="campaign-budget-input">Budget *</label>
                <input id="campaign-budget-input" className="input pq-num" data-testid="campaign-budget" inputMode="decimal" value={budgetText} placeholder="0"
                  aria-invalid={errors.budget ? true : undefined} onChange={(e) => { setBudgetText(e.target.value.replace(/[^0-9.]/g, '')); setErrors((x) => ({ ...x, budget: undefined })); }} />
                {errors.budget ? <span className="field-error">{errors.budget}</span> : <span className="pq-hint">The most you plan to spend.</span>}
              </div>
              <div className="field">
                <label className="field-label" htmlFor="campaign-target-input">Leads wanted</label>
                <input id="campaign-target-input" className="input pq-num" data-testid="campaign-target" inputMode="numeric" value={targetText} placeholder="0"
                  onChange={(e) => setTargetText(e.target.value.replace(/[^0-9]/g, ''))} />
                <span className="pq-hint">Sets the planned cost per lead.</span>
              </div>
            </div>
            <CustomFieldsSection module="campaigns" target="form" mode="edit" values={customFields} onChange={(k, v) => setCustomFields({ ...customFields, [k]: v })} errors={customErrors} includeIds={layoutCustomIds} />
          </div>

          <div className="form-actions contact-form-actions">
            <Link to={backTo} className="btn">Cancel</Link>
            <button type="button" className="btn btn-primary contacts-primary" disabled={busy} onClick={submit} data-testid="save-campaign-btn">
              {busy ? (existing ? 'Saving…' : 'Creating…') : existing ? 'Save changes' : 'Create campaign'}
            </button>
          </div>
        </div>

        <aside className="pq-prev cp-prev" aria-label="Preview">
          <section className="pq-card-box cp-pcard">
            <span className="pq-lab">Live preview</span>
            <div className="cp-pid">
              <ChannelBadge channel={channel || undefined} size="small" />
              <div><b>{name.trim() || <span className="pq-muted">Campaign name</span>}</b><span className="pq-muted">{channel || 'No channel yet'} · {shortRun(startDay, endDay)}</span></div>
            </div>
            <dl className="cp-plan">
              <dt>Budget</dt><dd>{budget > 0 ? money(budget) : '—'}</dd>
              <dt>Leads wanted</dt><dd>{target > 0 ? target : '—'}</dd>
              <dt>Planned cost per lead</dt><dd className="big" data-testid="campaign-planned-cpl">{plannedCpl ? money(plannedCpl) : '—'}</dd>
            </dl>
            <div className="cp-cmp">
              <span className="pq-lab">Cost per lead compared</span>
              <div>This plan<span className="t"><i style={{ '--w': `${plannedCpl ? (plannedCpl / most) * 100 : 0}%`, '--c': col } as CSSProperties} /></span><b>{plannedCpl ? moneyShort(plannedCpl) : '—'}</b></div>
              <div>{channel || 'Channel'}<span className="t"><i style={{ '--w': `${channelCpl ? (channelCpl / most) * 100 : 0}%`, '--c': '#8a93a6' } as CSSProperties} /></span><b>{channelCpl ? moneyShort(channelCpl) : '—'}</b></div>
              <div>All campaigns<span className="t"><i style={{ '--w': `${bankCpl ? (bankCpl / most) * 100 : 0}%`, '--c': '#c3c8d2' } as CSSProperties} /></span><b>{bankCpl ? moneyShort(bankCpl) : '—'}</b></div>
            </div>
          </section>
          {overlaps.length > 0 && (
            <div className="pq-note info" data-testid="campaign-overlap"><CalendarRange size={16} aria-hidden="true" />
              <span>Runs at the same time as {overlaps.map((c, i) => <span key={c.id}>{i ? ', ' : ''}<b>{c.name}</b></span>)} on {channel}. Leads may be counted for whichever reaches the customer first.</span>
            </div>
          )}
          {!finished && (startDay <= 0 ? (
            <div className="pq-note info"><Play size={16} aria-hidden="true" /><span>It starts today or earlier, so it is saved as running.</span></div>
          ) : (
            <div className="pq-note info"><Flag size={16} aria-hidden="true" /><span>Starts in {plural(startDay, 'day')}, so it is saved as planned and starts by itself on {dayText(dayIso(startDay))}.</span></div>
          ))}
        </aside>
      </div>
    </div>
  );
}

const shortRun = (s: number, e: number) => {
  const f = (d: number) => new Date(dayIso(d)).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  return `${f(s)} to ${f(e)}`;
};

interface Drag { kind: 's' | 'e' | 'm'; at: number; s: number; e: number }

/** The months around the run with two handles; other campaigns show as thin lines under it. */
function SeasonStrip({ campaigns, start, end, color, onChange }: { campaigns: Campaign[]; start: number; end: number; color: string; onChange: (s: number, e: number) => void }) {
  const line = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const now = Date.now();
  const today = startOfDay(now);
  const win = runWindow([...campaigns, { startDate: dayIso(start), endDate: dayIso(end, true) }], now);
  const at = (d: number) => pctOn(win, today + d * DAY);
  const lo = Math.round((win.from - today) / DAY);
  const hi = Math.round((win.to - today) / DAY) - 1;
  const live = useRef({ start, end, onChange, lo, hi });
  live.current = { start, end, onChange, lo, hi };

  useEffect(() => {
    // Window listeners: the handle re-renders under the pointer, so its own handlers would lose the drag.
    const dayAt = (x: number) => {
      const r = line.current!.getBoundingClientRect();
      return Math.round((win.from + ((x - r.left) / r.width) * (win.to - win.from) - today) / DAY);
    };
    const move = (e: PointerEvent) => {
      const d = drag.current;
      if (!d || !line.current) return;
      const { lo: min, hi: max, onChange: set } = live.current;
      const day = dayAt(e.clientX);
      if (d.kind === 's') set(Math.max(min, Math.min(day, live.current.end)), live.current.end);
      else if (d.kind === 'e') set(live.current.start, Math.min(max, Math.max(day - 1, live.current.start)));
      else {
        const shift = Math.max(min - d.s, Math.min(max - d.e, day - d.at));
        set(d.s + shift, d.e + shift);
      }
    };
    const up = () => { drag.current = null; };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); };
  }, [win.from, win.to, today]);

  const grab = (kind: Drag['kind']) => (e: ReactPointerEvent) => {
    e.preventDefault();
    const r = line.current!.getBoundingClientRect();
    drag.current = { kind, at: Math.round((win.from + ((e.clientX - r.left) / r.width) * (win.to - win.from) - today) / DAY), s: start, e: end };
  };
  const key = (kind: 's' | 'e') => (e: ReactKeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const step = (e.key === 'ArrowRight' ? 1 : -1) * (e.shiftKey ? 7 : 1);
    if (kind === 's') onChange(Math.max(lo, Math.min(end, start + step)), end);
    else onChange(start, Math.min(hi, Math.max(start, end + step)));
  };

  const len = end - start + 1;
  return (
    <div className="cp-season" style={hue(color)} data-testid="campaign-season">
      <div className="cp-sline" ref={line}>
        {win.months.map((m) => (
          <span key={m.at}><span className="g" style={{ left: `${pctOn(win, m.at)}%` }} /><span className="m" style={{ left: `${pctOn(win, m.at)}%` }}>{m.label}</span></span>
        ))}
        <span className="cp-tday" style={{ left: `${at(0)}%` }} title="Today" />
        {campaigns.map((c, i) => (
          <span key={c.id} className="cp-ghost" title={c.name}
            style={{ left: `${pctOn(win, Date.parse(c.startDate))}%`, width: `${Math.max(0.6, pctOn(win, Date.parse(c.endDate)) - pctOn(win, Date.parse(c.startDate)))}%`, bottom: `${4 + (i % 2) * 8}px`, '--c': channelHue(c.channel) } as CSSProperties} />
        ))}
        <span className="cp-sel" style={{ left: `${at(start)}%`, width: `${Math.max(0.5, at(end + 1) - at(start))}%` }} onPointerDown={grab('m')}>{plural(len, 'day')}</span>
        <span className="cp-hd" tabIndex={0} role="slider" aria-label="Start date" aria-valuemin={lo} aria-valuemax={end} aria-valuenow={start}
          aria-valuetext={dayText(dayIso(start))} style={{ left: `${at(start)}%` }} onPointerDown={grab('s')} onKeyDown={key('s')} data-testid="campaign-start-handle" />
        <span className="cp-hd" tabIndex={0} role="slider" aria-label="End date" aria-valuemin={start} aria-valuemax={hi} aria-valuenow={end}
          aria-valuetext={dayText(dayIso(end))} style={{ left: `${at(end + 1)}%` }} onPointerDown={grab('e')} onKeyDown={key('e')} data-testid="campaign-end-handle" />
      </div>
    </div>
  );
}
