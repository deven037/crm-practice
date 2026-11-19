import { CSSProperties, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Ban, ChevronLeft, Copy, Flag, MoreHorizontal, Pencil, Play, Plus, Trash2, TrendingUp, User as UserIcon } from 'lucide-react';
import { apiFetch } from '../data/apiFetch';
import { getAll, getAllSync, getById, removeMany } from '../data/store';
import { Campaign, Deal, Lead, User } from '../types';
import { Modal } from '../components/Modal';
import { CustomFieldsSection } from '../components/CustomFieldsSection';
import { Spinner } from '../components/Spinner';
import { useToast } from '../components/Toast';
import { useAuth } from '../auth/AuthContext';
import { useRecentlyViewed } from '../hooks/useRecentlyViewed';
import { classNames } from '../utils';
import { dayText, money, moneyShort, plural, shortDay } from './quotes/quoteLogic';
import { Face, userName } from './activity/activityBits';
import {
  canWriteCampaigns, channelHue, dayOffset, dayShort, expectedSpend, paceText, roiText, runDays, statsFor, stoppedAt, weeksOf,
} from './campaigns/campaignLogic';
import { CampaignStatusPill, ChannelBadge, ChannelChip, GoalRing, hue } from './campaigns/campaignBits';

type Stage = 'Leads' | 'Reached' | 'Deals' | 'Won';
const STEPS = ['Planned', 'Active', 'Completed'];
const LIST_SIZE = 6;

/**
 * A campaign's page: leads week by week across the run, spend against the budget and the expected pace, the goal,
 * cost per lead and return, a funnel from lead to won deal that lists who is in each stage, a spend log and history.
 */
export function CampaignDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const canWrite = canWriteCampaigns(user?.role);
  const { recordView, removeViews } = useRecentlyViewed();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'failed'>('loading');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [stage, setStage] = useState<Stage>('Leads');
  const [showAll, setShowAll] = useState(false);
  const [spendText, setSpendText] = useState('');
  const [spendNote, setSpendNote] = useState('');
  const [menu, setMenu] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [confirmName, setConfirmName] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    setState('loading');
    (async () => {
      try {
        const [c, l, d] = await Promise.all([getById<Campaign>('campaigns', id ?? '', true), getAll<Lead>('leads'), getAll<Deal>('deals')]);
        if (!alive) return;
        if (!c) { setState('missing'); removeViews([id ?? '']); return; }
        setCampaign(c);
        setLeads(l.filter((x) => x.campaignId === c.id));
        setDeals(d.filter((x) => x.campaignId === c.id));
        setState('ready');
      } catch (error) {
        if (!alive) return;
        if ((error as { status?: number }).status === 404) { setState('missing'); removeViews([id ?? '']); } else setState('failed');
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (campaign) recordView({ module: 'campaigns', id: campaign.id, label: campaign.name, link: `/campaigns/${campaign.id}`, meta: { Channel: campaign.channel, Status: campaign.status } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign?.id]);

  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(false); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', key); };
  }, [menu]);

  if (state === 'loading') return <Spinner label="Loading campaign…" />;
  if (state === 'failed') return <div className="banner banner-error" role="alert">This campaign couldn’t load. Check your connection and reload the page.</div>;
  if (state === 'missing' || !campaign) return <div className="empty-cell">Campaign not found. <Link to="/campaigns">Back to campaigns</Link></div>;

  const c = campaign;
  const users = getAllSync<User>('users');
  const owner = userName(users, c.ownerId);
  const col = channelHue(c.channel);
  const s = statsFor(c, leads, deals);
  const weeks = weeksOf(c, s.leads);
  const most = Math.max(...weeks.vals, 1);
  const len = runDays(c);
  const startIn = dayOffset(c.startDate);
  const endIn = dayOffset(c.endDate);
  const pace = c.status === 'Planned' ? (startIn > 0 ? `Starts in ${plural(startIn, 'day')}` : 'Starts today')
    : c.status === 'Active' ? `Day ${Math.min(len, 1 - startIn)} of ${len} · ${endIn > 0 ? `${plural(endIn, 'day')} left` : 'last day'}`
      : c.status === 'Completed' ? `Ran ${plural(len, 'day')}` : `Stopped ${dayText(stoppedAt(c))}`;
  const share = c.budget ? s.spent / c.budget : 0;
  const expect = expectedSpend(c);
  const paceWord = paceText(c, share);
  const stepAt = STEPS.indexOf(c.status);
  const ownDeals = [...s.deals].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const ownLeads = [...s.leads].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const funnel: [Stage, number, string][] = [
    ['Leads', s.leads.length, 'came in'],
    ['Reached', s.reached.length, 'followed up'],
    ['Deals', s.deals.length, 'opened'],
    ['Won', s.won.length, s.won.length ? moneyShort(s.wonValue) : 'none yet'],
  ];
  const widest = Math.max(s.leads.length, s.deals.length, 1);
  const inStage = stage === 'Leads' ? ownLeads : stage === 'Reached' ? ownLeads.filter((l) => s.reached.includes(l)) : stage === 'Deals' ? ownDeals : ownDeals.filter((d) => s.won.includes(d));
  const shown = showAll ? inStage : inStage.slice(0, LIST_SIZE);
  const history = [...(c.history ?? [])].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  const spendAmount = Math.round(Number(spendText.replace(/[^0-9.]/g, '')));
  const hasDependents = s.leads.length > 0 || s.deals.length > 0;

  const run = async (label: string, work: () => Promise<Campaign>) => {
    setBusy(true);
    try {
      const saved = await work();
      setCampaign(saved);
      toast.push('success', label);
      return true;
    } catch (error) {
      toast.push('error', (error as { message?: string }).message || 'That couldn’t be saved. Check your connection and try again.');
      return false;
    } finally {
      setBusy(false);
    }
  };
  const setStatus = (status: 'Active' | 'Completed' | 'Cancelled', why?: string) =>
    run(status === 'Active' ? `${c.name} started.` : status === 'Completed' ? `${c.name} marked complete.` : `${c.name} cancelled.`,
      () => apiFetch<Campaign>(`/campaigns/${c.id}/status`, { method: 'POST', body: JSON.stringify({ status, ...(why ? { reason: why } : {}) }) }));
  const addSpend = async () => {
    if (!(spendAmount > 0)) return;
    const ok = await run(`${money(spendAmount)} added. Spent is now ${moneyShort(s.spent + spendAmount)}.`,
      () => apiFetch<Campaign>(`/campaigns/${c.id}/spend`, { method: 'POST', body: JSON.stringify({ amount: spendAmount, ...(spendNote.trim() ? { note: spendNote.trim() } : {}) }) }));
    if (ok) { setSpendText(''); setSpendNote(''); }
  };
  const doDelete = async () => {
    setBusy(true);
    try {
      // The server unlinks the campaign's leads and deals; the records stay.
      await removeMany('campaigns', [c.id]);
      removeViews([c.id]);
      toast.push('success', `Campaign "${c.name}" deleted.${hasDependents ? ` ${plural(s.leads.length, 'lead')} and ${plural(s.deals.length, 'deal')} unlinked.` : ''}`);
      navigate('/campaigns');
    } catch {
      toast.push('error', 'The campaign couldn’t be deleted. Check your connection and try again.');
      setBusy(false);
    }
  };

  return (
    <div className="pq3 cp3" data-testid="campaign-detail-page">
      <Link to="/campaigns" className="contact-back"><ChevronLeft size={16} aria-hidden="true" /> All campaigns</Link>

      <div className="cp-head">
        <ChannelBadge channel={c.channel} />
        <div className="cp-head-t">
          <h1>{c.name}</h1>
          <div className="cp-meta">
            <CampaignStatusPill status={c.status} />
            <ChannelChip channel={c.channel} />
            {owner && <span className="cp-who"><Face id={c.ownerId ?? ''} name={owner} small />{owner}</span>}
            <span>{dayShort(c.startDate)} to {dayText(c.endDate)}</span>
          </div>
        </div>
        {canWrite && (
          <div className="cp-acts">
            {c.status === 'Planned' && <button type="button" className="btn btn-primary contacts-primary" disabled={busy} data-testid="start-campaign-btn" onClick={() => setStatus('Active')}><Play size={15} aria-hidden="true" /> Start now</button>}
            {c.status === 'Active' && <button type="button" className="btn btn-primary contacts-primary" disabled={busy} data-testid="complete-campaign-btn" onClick={() => setStatus('Completed')}><Flag size={15} aria-hidden="true" /> Mark complete</button>}
            <Link to={`/campaigns/${c.id}/edit`} className="btn" data-testid="edit-campaign-btn"><Pencil size={14} aria-hidden="true" /> Edit</Link>
            <Link to={`/leads/new?campaignId=${c.id}`} className="btn" data-testid="new-lead-for-campaign-btn"><Plus size={14} aria-hidden="true" /> New lead</Link>
            <div className="pq-menu" ref={menuRef}>
              <button type="button" className="btn pq-sq" aria-label="More actions" aria-haspopup="menu" aria-expanded={menu} data-testid="campaign-more" onClick={() => setMenu((m) => !m)}><MoreHorizontal size={17} aria-hidden="true" /></button>
              {menu && (
                <div className="pq-pop right" role="menu">
                  <button type="button" role="menuitem" className="pq-opt" onClick={() => navigate(`/campaigns/new?copy=${c.id}`)}><Copy size={16} aria-hidden="true" /> Duplicate</button>
                  {(c.status === 'Planned' || c.status === 'Active') && (
                    <button type="button" role="menuitem" className="pq-opt" data-testid="cancel-campaign-btn" onClick={() => { setMenu(false); setReason(''); setCancelling(true); }}><Ban size={16} aria-hidden="true" /> Cancel campaign</button>
                  )}
                  <button type="button" role="menuitem" className="pq-opt danger" data-testid="delete-campaign-btn" onClick={() => { setMenu(false); setConfirmName(''); setDeleting(true); }}><Trash2 size={16} aria-hidden="true" /> Delete</button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {c.status === 'Cancelled' ? (
        <div className="pq-note cp-gap">Cancelled {dayText(stoppedAt(c))}.{c.cancelReason ? ` Reason: ${c.cancelReason}.` : ''} Its leads and deals stay linked.</div>
      ) : (
        <div className="cp-steps" aria-label={`Status: ${c.status}`}>
          {STEPS.map((st, i) => <span key={st} className={classNames('cp-step', i === stepAt && 'on', i < stepAt && 'past')}>{st}</span>)}
        </div>
      )}

      <section className="pq-card-box cp-strip" style={hue(col)}>
        <div className="cp-strip-h"><h2>Leads each week</h2><span className="pq-muted">{plural(s.leads.length, 'lead')} so far</span><span className="cp-pace">{pace}</span></div>
        <div className="cp-weeks" data-testid="campaign-weeks">
          {Array.from({ length: weeks.n }, (_, i) => (i < weeks.done ? (
            <span key={i} className={classNames('cp-wk', c.status === 'Active' && i === weeks.done - 1 && 'now')} style={{ '--h': `${(weeks.vals[i] / most) * 100}%` } as CSSProperties} title={`Week ${i + 1}: ${plural(weeks.vals[i], 'lead')}`}>
              <i style={{ animationDelay: `${Math.min(i, 30) * 30}ms` }} /><b>{weeks.vals[i]}</b>
            </span>
          ) : (
            <span key={i} className="cp-wk future" title={`Week ${i + 1}: still to come`}><i /></span>
          )))}
        </div>
        <div className="cp-wl"><span>{dayShort(c.startDate)}</span>{c.status === 'Active' && weeks.n > 1 && <span className="cp-wl-now" style={{ left: `${(weeks.done / weeks.n) * 100}%` }}>Today</span>}<span>{dayShort(c.endDate)}</span></div>
      </section>

      <div className="cp-figs">
        <div className="pq-card-box cp-fig" style={hue(col)}>
          <span className="pq-lab">Spent</span>
          <b data-testid="campaign-spent">{moneyShort(s.spent)}</b>
          <div className={classNames('cp-gauge', share > 1 && 'over')} style={{ '--w': `${Math.min(1, share) * 100}%`, '--p': `${expect * 100}%` } as CSSProperties}
            title={c.status === 'Active' ? 'The line is where spend should be by today' : undefined}>
            <i />{c.status === 'Active' && <em />}
          </div>
          <small>{share > 1 ? `${money(s.spent - c.budget)} over the ${moneyShort(c.budget)} budget` : `of ${moneyShort(c.budget)}${paceWord ? ` · ${paceWord}` : ''}`}</small>
        </div>
        <div className="pq-card-box cp-fig">
          <span className="pq-lab">Leads</span>
          <div className="cp-ringf">
            <GoalRing value={s.leads.length} max={c.targetLeads || s.leads.length} color={col} />
            <div><b>{s.leads.length}</b><small>{c.targetLeads ? `of ${c.targetLeads} wanted` : 'no goal set'}</small></div>
          </div>
        </div>
        <div className="pq-card-box cp-fig">
          <span className="pq-lab">Cost per lead</span>
          <b>{s.cpl === null ? '—' : money(s.cpl)}</b>
          <small>{s.plannedCpl === null ? 'No goal set' : s.cpl === null ? `Planned: ${money(s.plannedCpl)}` : s.cpl <= s.plannedCpl ? `Under the planned ${money(s.plannedCpl)}` : `Above the planned ${money(s.plannedCpl)}`}</small>
        </div>
        <div className="pq-card-box cp-fig">
          <span className="pq-lab">Return</span>
          <b className={classNames(s.roi !== null && s.roi < 1 && 'cp-lo')} data-testid="campaign-roi">{roiText(s.roi)}</b>
          <small>{s.won.length ? `${moneyShort(s.wonValue)} won from ${plural(s.won.length, 'deal')}` : 'No deals won yet'}</small>
        </div>
      </div>

      <div className="pq-cols">
        <div className="pq-stack">
          <section className="pq-card-box pq-box cp-funnel">
            <div className="pq-box-h"><h2>From lead to won deal</h2><span className="pq-muted">Pick a stage to see who is in it</span></div>
            <div className="cp-fun" data-testid="campaign-funnel">
              {funnel.map(([name, v, sub], i) => {
                const prev = i ? funnel[i - 1][1] : 0;
                const w = Math.max(14, (v / widest) * 100);
                return (
                  <button key={name} type="button" className="cp-fs" aria-pressed={stage === name} data-testid={`campaign-stage-${name.toLowerCase()}`} onClick={() => { setStage(name); setShowAll(false); }}>
                    <span className="nm">{name}<small>{sub}</small></span>
                    <span className="bw"><span className="band" style={{ '--w': `${w}%`, '--k': `${Math.min(22, w / 6)}px`, '--c': col, filter: `saturate(${1 - i * 0.12})`, animationDelay: `${i * 60}ms` } as CSSProperties}>{v}</span></span>
                    <span className="cv">{i > 0 && <><b>{prev ? `${Math.round((v / prev) * 100)}%` : '—'}</b>of {funnel[i - 1][0].toLowerCase()}</>}</span>
                  </button>
                );
              })}
            </div>
            <div className="cp-flist" data-testid="campaign-stage-list">
              <span className="pq-lab">{stage} · {inStage.length}</span>
              {inStage.length === 0 && <p className="pq-muted cp-none">Nobody here yet.</p>}
              {shown.map((r) => ('stage' in r ? (
                <Link key={r.id} to={`/deals/${r.id}`} className="cp-li"><TrendingUp size={15} aria-hidden="true" /><span>{r.name}</span><small>{moneyShort(r.amount)} · {r.stage}</small></Link>
              ) : (
                <Link key={r.id} to={`/leads/${r.id}`} className="cp-li"><UserIcon size={15} aria-hidden="true" /><span>{r.name}<small> · {r.company}</small></span><small>{r.status}</small></Link>
              )))}
              {inStage.length > LIST_SIZE && <button type="button" className="link cp-more" onClick={() => setShowAll((x) => !x)}>{showAll ? 'Show fewer' : `Show all ${inStage.length}`}</button>}
            </div>
          </section>
        </div>
        <div className="pq-stack">
          <section className="pq-card-box pq-box">
            <h2>Details</h2>
            <dl className="pq-kv">
              <div><dt>Channel</dt><dd><ChannelChip channel={c.channel} /></dd></div>
              <div><dt>Owner</dt><dd>{owner ? <span className="cp-who"><Face id={c.ownerId ?? ''} name={owner} small />{owner}</span> : '—'}</dd></div>
              <div><dt>Runs</dt><dd>{dayShort(c.startDate)} to {dayText(c.endDate)}</dd></div>
              <div><dt>Budget</dt><dd>{money(c.budget)}</dd></div>
              <div><dt>Leads wanted</dt><dd>{c.targetLeads || '—'}</dd></div>
              {c.audience && <div><dt>For</dt><dd>{c.audience}</dd></div>}
              <div><dt>Created</dt><dd>{dayText(c.createdAt)}</dd></div>
              {c.layoutName && <div><dt>Layout</dt><dd>{c.layoutName}</dd></div>}
            </dl>
            <CustomFieldsSection module="campaigns" target="detail" mode="view" values={c.customFields ?? {}} />
          </section>
          {canWrite && (c.status === 'Active' || c.status === 'Completed') && (
            <section className="pq-card-box pq-box">
              <h2 className="cp-h-tight">Log spend</h2>
              <p className="pq-muted pq-small cp-h-sub">Add what was paid out, such as an invoice from the agency.</p>
              <div className="cp-spend">
                <input className="input cp-amt" inputMode="decimal" value={spendText} placeholder="Amount" aria-label="Amount spent" data-testid="campaign-spend-input"
                  onChange={(e) => setSpendText(e.target.value.replace(/[^0-9.]/g, ''))} onKeyDown={(e) => { if (e.key === 'Enter') addSpend(); }} />
                <button type="button" className="btn" disabled={busy || !(spendAmount > 0)} data-testid="campaign-spend-add" onClick={addSpend}>Add</button>
              </div>
              <input className="input cp-note-in" value={spendNote} maxLength={200} placeholder="What it was for (optional)" aria-label="What the spend was for" onChange={(e) => setSpendNote(e.target.value)} />
            </section>
          )}
          <section className="pq-card-box pq-box" data-testid="campaign-history">
            <h2>History</h2>
            <div className="cp-hist">
              {history.length === 0 && <p className="pq-muted">Nothing yet.</p>}
              {history.map((h, i) => (
                <div key={`${h.at}-${i}`}>
                  <small>{shortDay(h.at)}</small>
                  <span>{h.amount !== undefined ? <><b>{money(h.amount)}</b> {h.text.replace(/^Spend logged/, 'spend logged')}</> : h.text}<small> · {h.by}</small></span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      {cancelling && (
        <Modal
          title={`Cancel ${c.name}?`}
          onClose={() => setCancelling(false)}
          footer={
            <>
              <button className="btn" onClick={() => setCancelling(false)}>Keep running</button>
              <button className="btn btn-primary" disabled={busy} data-testid="confirm-cancel-btn" onClick={async () => { if (await setStatus('Cancelled', reason.trim())) setCancelling(false); }}>Cancel campaign</button>
            </>
          }
        >
          <p>It stops counting as running from today. Leads and deals it brought stay linked.</p>
          <div className="field">
            <label className="field-label" htmlFor="campaign-cancel-reason">Reason</label>
            <input id="campaign-cancel-reason" className="input" maxLength={300} placeholder="For example, results too low for the spend" value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
        </Modal>
      )}

      {deleting && (
        <Modal
          title={`Delete ${c.name}?`}
          onClose={() => setDeleting(false)}
          footer={
            <>
              {(c.status === 'Planned' || c.status === 'Active') && <button className="btn" onClick={() => { setReason(''); setDeleting(false); setCancelling(true); }}>Cancel it instead</button>}
              <button className="btn" onClick={() => setDeleting(false)}>Keep</button>
              <button className="btn btn-danger" data-testid="confirm-delete-btn" disabled={busy || (hasDependents && confirmName !== c.name)} onClick={doDelete}>Delete campaign</button>
            </>
          }
        >
          {!hasDependents ? (
            <p>This cannot be undone.</p>
          ) : (
            <>
              <p>{plural(s.leads.length, 'lead')} and {plural(s.deals.length, 'deal')} keep their records but lose the link to this campaign. This cannot be undone.</p>
              <div className="field">
                <label className="field-label" htmlFor="campaign-delete-confirm">Type the campaign name to confirm</label>
                <input id="campaign-delete-confirm" className="input" data-testid="delete-confirm-input" placeholder={c.name} value={confirmName} onChange={(e) => setConfirmName(e.target.value)} />
              </div>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}

