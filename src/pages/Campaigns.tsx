import { CSSProperties, KeyboardEvent, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { AlignLeft, Megaphone, Plus, Search, Trophy } from 'lucide-react';
import { apiFetch } from '../data/apiFetch';
import { getAll, getAllSync } from '../data/store';
import { Campaign, Deal, Lead, User } from '../types';
import { ToolBoxMenu } from '../components/ToolBoxMenu';
import { LayoutPickerPanel } from '../components/LayoutPickerPanel';
import { useAuth } from '../auth/AuthContext';
import { classNames } from '../utils';
import { StatusPicker } from './leads/StatusPicker';
import { money, moneyShort, plural } from './quotes/quoteLogic';
import { userName } from './activity/activityBits';
import {
  CampaignStats, campaignChannels, canWriteCampaigns, channelHue, dayShort, matchesCampaign, pctOn, roiText, roiTone,
  runWindow, statsFor, STATUSES, totals,
} from './campaigns/campaignLogic';
import { CampaignStatusPill, ChannelChip } from './campaigns/campaignBits';

export const CAMPAIGN_TOOLBOX_LINKS = [
  { label: 'Import data', to: '/setup/import' },
  { label: 'Custom fields', to: '/admin/objects/campaigns' },
  { label: 'Customise page layout', to: '/setup/layouts/campaigns' },
  { label: 'Channels', to: '/setup/status-codes' },
];

interface Tip { id: string; left: number; top: number }

/**
 * The campaigns desk: what the money did (won value per rupee spent), then every campaign as a capsule on a
 * timeline of months with a line for today, or ranked on a scoreboard by return.
 */
export function Campaigns() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canWrite = canWriteCampaigns(user?.role);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const users = getAllSync<User>('users');
  const [query, setQuery] = useState('');
  const [channels, setChannels] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<string[]>([]);
  const [view, setView] = useState<'runway' | 'score'>('runway');
  const [tip, setTip] = useState<Tip | null>(null);
  const [layoutPickerOpen, setLayoutPickerOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      // Start and end campaigns whose dates have come before reading them; a failed refresh is not worth stopping for.
      await apiFetch('/campaigns/refresh', { method: 'POST' }).catch(() => undefined);
      try {
        const [c, l, d] = await Promise.all([getAll<Campaign>('campaigns'), getAll<Lead>('leads'), getAll<Deal>('deals')]);
        if (!alive) return;
        setCampaigns([...c]);
        setLeads([...l]);
        setDeals([...d]);
      } catch {
        if (alive) setFailed(true);
      }
      if (alive) setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!tip) return;
    const hide = () => setTip(null);
    window.addEventListener('scroll', hide, true);
    return () => window.removeEventListener('scroll', hide, true);
  }, [tip]);

  const stats = useMemo(() => new Map<string, CampaignStats>(campaigns.map((c) => [c.id, statsFor(c, leads, deals)])), [campaigns, leads, deals]);
  const sum = totals(campaigns, stats);
  const visible = campaigns
    .filter((c) => matchesCampaign(c, query, userName(users, c.ownerId)))
    .filter((c) => !channels.length || channels.includes(c.channel))
    .filter((c) => !statuses.length || statuses.includes(c.status));
  const filtered = !!query || channels.length > 0 || statuses.length > 0;
  const allChannels = [...new Set([...campaignChannels(), ...campaigns.map((c) => c.channel)])];
  const open = (id: string) => navigate(`/campaigns/${id}`);
  const onKey = (id: string) => (e: KeyboardEvent) => { if (e.key === 'Enter' && e.target === e.currentTarget) open(id); };

  const showTip = (id: string, el: HTMLElement, pointer: string) => {
    if (pointer === 'touch') return;
    const cap = (el.querySelector('.cp-cap') ?? el).getBoundingClientRect();
    const left = Math.min(window.innerWidth - 266, Math.max(8, cap.left));
    const top = cap.bottom + 8 + 200 > window.innerHeight ? cap.top - 8 - 190 : cap.bottom + 8;
    setTip({ id, left, top });
  };
  const tipped = tip ? campaigns.find((c) => c.id === tip.id) : undefined;
  const tipStats = tipped ? stats.get(tipped.id) : undefined;

  const mx = Math.max(sum.won, sum.budget, sum.spent, 1);
  const since = campaigns.filter((c) => c.status !== 'Planned').map((c) => Date.parse(c.startDate)).sort((a, b) => a - b)[0];

  return (
    <div className="pq3 cp3" data-testid="campaigns-page">
      <div className="page-header">
        <div>
          <h1>Campaigns</h1>
          <p className="pq-sub">{plural(campaigns.length, 'campaign')}. Each one is judged by the deals its leads bring in.</p>
        </div>
        <div className="page-actions">
          <ToolBoxMenu links={CAMPAIGN_TOOLBOX_LINKS} />
          {canWrite && (
            <button className="btn btn-primary contacts-primary" data-testid="new-campaign" onClick={() => setLayoutPickerOpen(true)}>
              <Plus size={16} aria-hidden="true" /> New campaign
            </button>
          )}
        </div>
      </div>

      {!loading && !failed && (
        <section className="cp-hero" data-testid="campaign-return">
          <div className="cp-hero-t">
            <span className="cp-hlab">{since ? `All campaigns since ${new Date(since).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}` : 'All campaigns'}</span>
            <div className="cp-ret"><b>{sum.roi === null ? '—' : `${sum.roi.toFixed(1)}×`}</b><span>{sum.roi === null ? 'nothing spent yet' : 'back for every rupee spent'}</span></div>
            <p>
              {sum.spent
                ? <>{moneyShort(sum.spent)} spent on {plural(sum.live, 'campaign')} brought {plural(sum.leads, 'lead')} and {plural(sum.wonDeals, 'won deal')} worth {moneyShort(sum.won)}.</>
                : 'Once a campaign starts and spend is logged, this shows what each rupee brought back.'}
            </p>
            <div className="cp-ticks">
              <div><b>{sum.cpl === null ? '—' : moneyShort(sum.cpl)}</b><small>per lead</small></div>
              <div><b>{sum.running}</b><small>running now</small></div>
              <div><b>{sum.planned}</b><small>planned</small></div>
            </div>
          </div>
          <div className="cp-bars" aria-label="Budget, spent and won">
            <div className="cp-bar"><span>Budget</span><span className="t"><i style={{ '--w': `${(sum.budget / mx) * 100}%`, '--c': 'rgba(255,255,255,.35)' } as CSSProperties} /></span><b>{moneyShort(sum.budget)}</b></div>
            <div className="cp-bar"><span>Spent</span><span className="t"><i style={{ '--w': `${(sum.spent / mx) * 100}%`, '--c': '#f2b84b', animationDelay: '.1s' } as CSSProperties} /></span><b>{moneyShort(sum.spent)}</b></div>
            <div className="cp-bar"><span>Won</span><span className="t"><i style={{ '--w': `${(sum.won / mx) * 100}%`, '--c': '#3fd29a', animationDelay: '.2s' } as CSSProperties} /></span><b>{moneyShort(sum.won)}</b></div>
          </div>
        </section>
      )}

      <div className="pq-tools">
        <div className="contact-find pq-search">
          <Search size={17} aria-hidden="true" />
          <input type="search" className="input search-input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search campaigns" aria-label="Search campaigns" data-testid="campaign-search" />
        </div>
        <StatusPicker options={allChannels} selected={channels} multi label="Channel" testId="campaign-channel-filter"
          className={classNames('pq-fchip', channels.length > 0 && 'set')}
          onPick={(v) => setChannels((list) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]))}>
          <Megaphone size={14} aria-hidden="true" /> {channels.length ? (channels.length === 1 ? channels[0] : `${channels.length} channels`) : 'Channel'}
        </StatusPicker>
        <StatusPicker options={STATUSES} selected={statuses} multi label="Status" testId="campaign-status-filter"
          className={classNames('pq-fchip', statuses.length > 0 && 'set')}
          onPick={(v) => setStatuses((list) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]))}>
          {statuses.length ? (statuses.length === 1 ? statuses[0] : `${statuses.length} statuses`) : 'Status'}
        </StatusPicker>
        {filtered && <button type="button" className="btn btn-ghost" onClick={() => { setQuery(''); setChannels([]); setStatuses([]); }}>Clear</button>}
        <span className="pq-spacer" />
        <div className="tk-seg" role="group" aria-label="View">
          <button type="button" aria-pressed={view === 'runway'} data-testid="view-runway" onClick={() => { setTip(null); setView('runway'); }}><AlignLeft size={14} aria-hidden="true" /> Runway</button>
          <button type="button" aria-pressed={view === 'score'} data-testid="view-scoreboard" onClick={() => { setTip(null); setView('score'); }}><Trophy size={14} aria-hidden="true" /> Scoreboard</button>
        </div>
      </div>

      {failed && <div className="banner banner-error" role="alert">Campaigns couldn’t load. Check your connection and reload the page.</div>}
      {loading && <div className="pq-card-box pq-empty">Loading campaigns…</div>}
      {!loading && !failed && campaigns.length === 0 && (
        <div className="pq-card-box pq-empty"><b>No campaigns yet</b>{canWrite ? 'Plan the first one with New campaign.' : ''}</div>
      )}

      {!loading && !failed && campaigns.length > 0 && view === 'runway' && <Runway list={visible} stats={stats} onOpen={open} onKey={onKey} onTip={showTip} onUntip={() => setTip(null)} />}
      {!loading && !failed && campaigns.length > 0 && view === 'score' && <Scoreboard list={visible} stats={stats} onOpen={open} onKey={onKey} />}

      {tip && tipped && tipStats && createPortal(
        <div className="cp-tip" style={{ left: tip.left, top: tip.top }} role="tooltip">
          <b>{tipped.name}</b>
          <CampaignStatusPill status={tipped.status} /> <span className="pq-muted">{dayShort(tipped.startDate)} to {dayShort(tipped.endDate)}</span>
          <dl>
            <dt>Spent</dt><dd>{moneyShort(tipStats.spent)} of {moneyShort(tipped.budget)}</dd>
            <dt>Leads</dt><dd>{tipStats.leads.length}{tipped.targetLeads ? ` of ${tipped.targetLeads}` : ''}</dd>
            <dt>Won</dt><dd>{tipStats.won.length ? moneyShort(tipStats.wonValue) : '—'}</dd>
            <dt>Return</dt><dd>{roiText(tipStats.roi)}</dd>
          </dl>
        </div>,
        document.body,
      )}

      {layoutPickerOpen && <LayoutPickerPanel module="campaigns" basePath="/campaigns" onClose={() => setLayoutPickerOpen(false)} />}
    </div>
  );
}

interface ListProps {
  list: Campaign[];
  stats: Map<string, CampaignStats>;
  onOpen: (id: string) => void;
  onKey: (id: string) => (e: KeyboardEvent) => void;
}

function Runway({ list, stats, onOpen, onKey, onTip, onUntip }: ListProps & { onTip: (id: string, el: HTMLElement, pointer: string) => void; onUntip: () => void }) {
  const now = Date.now();
  const win = runWindow(list, now);
  const rows = [...list].sort((a, b) => Date.parse(a.startDate) - Date.parse(b.startDate));
  const grid = win.months.map((m) => <span key={m.at} className="cp-grid" style={{ left: `${pctOn(win, m.at)}%` }} />);
  return (
    <section className="pq-card-box cp-run" data-testid="campaign-runway">
      <div className="cp-rh"><span className="pq-lab">Campaign</span>
        <div className="cp-months">{win.months.map((m) => <span key={m.at} style={{ left: `${pctOn(win, m.at)}%` }}>{m.label}</span>)}</div>
      </div>
      <div className="cp-rows" onPointerLeave={onUntip}>
        {rows.length === 0 && <div className="pq-empty"><b>No campaigns match</b>Try another word, or clear the filters.</div>}
        {rows.map((c, i) => {
          const s = stats.get(c.id)!;
          const startMs = Date.parse(c.startDate);
          const endMs = Date.parse(c.endDate);
          const left = pctOn(win, startMs);
          const width = Math.max(pctOn(win, endMs) - left, 0.4);
          const spentShare = c.budget ? Math.min(1, s.spent / c.budget) : 0;
          const tiny = endMs - startMs < 14 * 86_400_000 || width < 6;
          const label = c.status === 'Planned' ? `Starts ${dayShort(c.startDate)}` : plural(s.leads.length, 'lead');
          const cls = c.status === 'Planned' ? 'planned' : c.status === 'Cancelled' ? 'cancelled' : c.status === 'Completed' ? 'done' : '';
          const pale = cls !== 'planned' && spentShare < 0.35;
          return (
            <div key={c.id} className="cp-rr" role="link" tabIndex={0} aria-label={`${c.name}, ${c.status}, ${label}`} style={{ animationDelay: `${Math.min(i, 16) * 40}ms` }}
              data-testid={`campaign-row-${c.id}`} onClick={() => onOpen(c.id)} onKeyDown={onKey(c.id)}
              onPointerEnter={(e) => onTip(c.id, e.currentTarget, e.pointerType)}>
              <div className="cp-rn"><b>{c.name}</b><ChannelChip channel={c.channel} /></div>
              <div className="cp-track">
                {grid}
                <span className={classNames('cp-cap', cls, pale && 'pale')} style={{ left: `${left}%`, width: `${width}%`, '--c': channelHue(c.channel), '--s': `${spentShare * 100}%`, animationDelay: `${Math.min(i, 16) * 40 + 120}ms` } as CSSProperties}>
                  <i className="sp" />{!tiny && <span>{label}</span>}
                </span>
                {tiny && <span className="cp-capl" style={{ left: `calc(${left + width}% + 8px)` }}>{label}</span>}
              </div>
            </div>
          );
        })}
        {rows.length > 0 && (
          <div className="cp-rh cp-over" aria-hidden="true"><span /><div className="cp-over-t"><span className="cp-today" style={{ left: `${pctOn(win, now)}%` }} /></div></div>
        )}
      </div>
      <div className="cp-key">
        <span><i className="k half" />Filled part: budget spent</span>
        <span><i className="k pl" />Planned</span>
        <span><i className="k today" />Today</span>
        <span>Hover a campaign for its numbers</span>
      </div>
    </section>
  );
}

function Scoreboard({ list, stats, onOpen, onKey }: ListProps) {
  const rows = list.filter((c) => c.status !== 'Planned').sort((a, b) => (stats.get(b.id)!.roi ?? -1) - (stats.get(a.id)!.roi ?? -1));
  const mx = Math.max(...rows.map((c) => Math.max(stats.get(c.id)!.spent, stats.get(c.id)!.wonValue)), 1);
  return (
    <section className="pq-card-box" data-testid="campaign-scoreboard">
      <div className="cp-sb-row head"><span>#</span><span>Campaign</span><span>Spent and won</span><span className="r">Return</span><span className="r">Per lead</span><span>Status</span></div>
      {rows.map((c, i) => {
        const s = stats.get(c.id)!;
        return (
          <div key={c.id} className="cp-sb-row" role="link" tabIndex={0} style={{ animationDelay: `${Math.min(i, 16) * 40}ms` }} data-testid={`campaign-score-${c.id}`}
            onClick={() => onOpen(c.id)} onKeyDown={onKey(c.id)}>
            <span className={classNames('cp-rank', i < 3 && `r${i + 1}`)}>{i + 1}</span>
            <span className="cp-sb-n"><b>{c.name}</b><ChannelChip channel={c.channel} /></span>
            <span className="cp-twin">
              <div>Spent<span className="t"><i style={{ '--w': `${(s.spent / mx) * 100}%`, '--c': '#e0a23a' } as CSSProperties} /></span><b>{moneyShort(s.spent)}</b></div>
              <div>Won<span className="t"><i style={{ '--w': `${(s.wonValue / mx) * 100}%`, '--c': '#1f9d63', animationDelay: '.1s' } as CSSProperties} /></span><b>{moneyShort(s.wonValue)}</b></div>
            </span>
            <span className={classNames('r cp-x', roiTone(s.roi))}>{roiText(s.roi)}</span>
            <span className="r cp-num">{s.cpl === null ? '—' : money(s.cpl)}</span>
            <span><CampaignStatusPill status={c.status} /></span>
          </div>
        );
      })}
      {rows.length === 0 && <div className="pq-empty"><b>Nothing to rank yet</b>Campaigns show here once they start.</div>}
      <div className="cp-key"><span>Return: value of deals won from the campaign’s leads and deals, for each rupee spent. Planned campaigns are left out.</span></div>
    </section>
  );
}

