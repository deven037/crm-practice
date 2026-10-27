import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAll } from '../data/store';
import { Activity, Deal, DEAL_STAGES, Lead, LEAD_STATUSES, TaskItem, Ticket } from '../types';
import { BarChart, DonutChart } from '../components/charts';
import { Select } from '../components/Select';
import { SkeletonRows } from '../components/Spinner';
import { useToast } from '../components/Toast';
import { useAuth } from '../auth/AuthContext';
import { isDueToday, timeAgo } from '../utils';

const RANGES = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: '365', label: 'Last year' },
];

const PAGE_SIZE = 12;
const DAY_MS = 24 * 60 * 60 * 1000;
const LOAD_TIMEOUT_MS = 10_000;

// Product name and bank identity are replaceable; the bank settings are shared with Login.
const PRODUCT_NAME = import.meta.env.VITE_PRODUCT_NAME?.trim() || 'Harbor CRM';
const BANK_NAME = import.meta.env.VITE_BANK_NAME?.trim() || 'Your bank';
const BANK_LOGO_URL = import.meta.env.VITE_BANK_LOGO_URL?.trim();

function makeMoneyFormatter(): (amount: number) => string {
  const locale = import.meta.env.VITE_BANK_LOCALE?.trim() || 'en-US';
  const currency = import.meta.env.VITE_BANK_CURRENCY?.trim() || 'USD';
  try {
    const fmt = new Intl.NumberFormat(locale, { style: 'currency', currency, notation: 'compact', maximumFractionDigits: 2 });
    return (amount) => fmt.format(amount);
  } catch {
    // An invalid locale or currency code in the settings must not break the page.
    const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 2 });
    return (amount) => fmt.format(amount);
  }
}
const formatMoney = makeMoneyFormatter();

type DataKey = 'leads' | 'deals' | 'tasks' | 'tickets' | 'activities';

function withTimeout<T>(p: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), LOAD_TIMEOUT_MS);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

function Unavailable({ what, onRetry }: { what: string; onRetry: () => void }) {
  return (
    <div className="dash-unavailable" data-testid={`dash-unavailable-${what}`}>
      <span>Couldn’t load {what}.</span>
      <button type="button" className="btn-link" onClick={onRetry}>
        Retry
      </button>
    </div>
  );
}

export function Dashboard() {
  const { user } = useAuth();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState<DataKey[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [range, setRange] = useState('30');
  const [visibleActivities, setVisibleActivities] = useState(PAGE_SIZE);
  const feedRef = useRef<HTMLDivElement>(null);
  const retryRef = useRef<HTMLButtonElement>(null);
  const focusRetry = useRef(false);
  const loadId = useRef(0);

  const load = useCallback(async (only?: DataKey[]) => {
    const id = ++loadId.current;
    setLoading(true);
    const loaders: Record<DataKey, () => Promise<unknown>> = {
      leads: async () => setLeads(await withTimeout(getAll<Lead>('leads'))),
      deals: async () => setDeals(await withTimeout(getAll<Deal>('deals'))),
      tasks: async () => setTasks(await withTimeout(getAll<TaskItem>('tasks'))),
      tickets: async () => setTickets(await withTimeout(getAll<Ticket>('tickets'))),
      activities: async () => setActivities(await withTimeout(getAll<Activity>('activities'))),
    };
    const keys = only ?? (Object.keys(loaders) as DataKey[]);
    const results = await Promise.allSettled(keys.map((k) => loaders[k]()));
    if (id !== loadId.current) return;
    const stillFailed = keys.filter((_, i) => results[i].status === 'rejected');
    setFailed((prev) => [...prev.filter((k) => !keys.includes(k)), ...stillFailed]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    return () => {
      loadId.current++;
    };
  }, [load]);

  useEffect(() => {
    // Welcome toast once per browser session — an auto-appearing element to handle in tests.
    if (user && !sessionStorage.getItem('crm.welcomed')) {
      sessionStorage.setItem('crm.welcomed', '1');
      toast.push('info', `Welcome back, ${user.name.split(' ')[0]}!`);
    }
  }, [user, toast]);

  useEffect(() => {
    // Focus Retry only after a user-triggered retry that failed again, not on first load.
    if (!loading && focusRetry.current) {
      focusRetry.current = false;
      retryRef.current?.focus();
    }
  }, [loading]);

  const days = Number(range);
  const rangeLabel = RANGES.find((r) => r.value === range)?.label ?? `Last ${days} days`;
  const cutoff = useMemo(() => Date.now() - days * DAY_MS, [days]);
  const rangedLeads = useMemo(() => leads.filter((l) => new Date(l.createdAt).getTime() >= cutoff), [leads, cutoff]);
  const rangedDeals = useMemo(() => deals.filter((d) => new Date(d.createdAt).getTime() >= cutoff), [deals, cutoff]);

  const openDeals = deals.filter((d) => !d.stage.startsWith('Closed'));
  const openPipeline = openDeals.reduce((sum, d) => sum + d.amount, 0);
  const dueToday = tasks.filter((t) => !t.completed && isDueToday(t.dueDate)).length;
  const openTickets = tickets.filter((t) => t.status === 'Open' || t.status === 'In Progress').length;

  const wonIn = (from: number, to: number) =>
    deals.filter((d) => {
      if (d.stage !== 'Closed Won') return false;
      const closed = new Date(d.closeDate).getTime();
      return closed >= from && closed < to;
    });
  const wonDeals = wonIn(cutoff, Date.now() + 1);
  const wonRevenue = wonDeals.reduce((sum, d) => sum + d.amount, 0);
  const previousWon = wonIn(cutoff - days * DAY_MS, cutoff).reduce((sum, d) => sum + d.amount, 0);

  const dealsByStage = DEAL_STAGES.map((stage) => ({
    label: stage.replace('Closed ', ''),
    value: rangedDeals.filter((d) => d.stage === stage).length,
  }));
  const leadsByStatus = LEAD_STATUSES.filter((s) => s !== 'Converted').map((status) => ({
    label: status,
    value: rangedLeads.filter((l) => l.status === status).length,
  }));

  const handleFeedScroll = () => {
    const el = feedRef.current;
    if (!el || visibleActivities >= activities.length) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 60) {
      setVisibleActivities((v) => v + PAGE_SIZE);
    }
  };

  const retryAll = () => {
    focusRetry.current = true;
    load();
  };
  const retryOne = (key: DataKey) => () => load([key]);
  const isFailed = (key: DataKey) => failed.includes(key);
  const allFailed = failed.length === 5;
  // Keep the error panel on screen while a retry runs so the Retry button keeps focus and shows its state.
  const showError = allFailed;

  return (
    <div data-testid="dashboard-page">
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p className="dash-sub" data-testid="dashboard-identity">
            <span className="dash-product">{PRODUCT_NAME}</span>
            <span className="dash-bank">
              {BANK_LOGO_URL && <img className="dash-bank-logo" src={BANK_LOGO_URL} alt="" />}
              <span>{BANK_NAME}</span>
            </span>
          </p>
          <p className="dash-sub">Metrics marked with a range follow the date range you pick.</p>
        </div>
        <div className="page-actions">
          <Select value={range} options={RANGES} onChange={setRange} testId="dashboard-range" />
        </div>
      </div>

      {loading && !showError ? (
        <div role="status" aria-label="Loading dashboard">
          <SkeletonRows rows={8} />
        </div>
      ) : showError ? (
        <div className="dash-error" role="alert" data-testid="dashboard-error">
          <h3>Dashboard didn’t load</h3>
          <p>We couldn’t reach the server, so no figures are shown. Your data is unchanged. Check your connection and try again.</p>
          <button
            type="button"
            ref={retryRef}
            className="btn btn-primary dash-retry"
            data-testid="dashboard-retry"
            aria-busy={loading}
            disabled={loading}
            onClick={retryAll}
          >
            {loading ? 'Retrying…' : 'Retry'}
          </button>
        </div>
      ) : (
        <>
          <div className="stat-grid">
            <Link className="stat-tile stat-link" data-testid="stat-leads" to={`/leads?created=${days}d`}>
              <span className="stat-top">
                <span className="stat-label">New leads</span>
                <span className="range-chip">{rangeLabel}</span>
              </span>
              {isFailed('leads') ? (
                <span className="stat-hint">Couldn’t load leads.</span>
              ) : (
                <>
                  <span className="stat-value">{rangedLeads.length}</span>
                  <span className="stat-hint">{leads.length} leads in total</span>
                </>
              )}
              <span className="stat-go">View new leads</span>
            </Link>
            <Link className="stat-tile stat-link" data-testid="stat-pipeline" to="/deals?stage=open">
              <span className="stat-top">
                <span className="stat-label">Open pipeline</span>
                <span className="range-chip now">Right now</span>
              </span>
              {isFailed('deals') ? (
                <span className="stat-hint">Couldn’t load deals.</span>
              ) : (
                <>
                  <span className="stat-value">{formatMoney(openPipeline)}</span>
                  <span className="stat-hint">{openDeals.length} open deals</span>
                </>
              )}
              <span className="stat-go">View open deals</span>
            </Link>
            <Link className="stat-tile stat-link" data-testid="stat-tasks" to="/tasks?due=today">
              <span className="stat-top">
                <span className="stat-label">Tasks due</span>
                <span className="range-chip now">Today</span>
              </span>
              {isFailed('tasks') ? (
                <span className="stat-hint">Couldn’t load tasks.</span>
              ) : (
                <>
                  <span className="stat-value">{dueToday}</span>
                  <span className="stat-hint">{tasks.filter((t) => !t.completed).length} open tasks in total</span>
                </>
              )}
              <span className="stat-go">View today’s tasks</span>
            </Link>
            <Link className="stat-tile stat-link" data-testid="stat-tickets" to="/tickets?status=open">
              <span className="stat-top">
                <span className="stat-label">Open tickets</span>
                <span className="range-chip now">Right now</span>
              </span>
              {isFailed('tickets') ? (
                <span className="stat-hint">Couldn’t load tickets.</span>
              ) : (
                <>
                  <span className="stat-value">{openTickets}</span>
                  <span className="stat-hint">of {tickets.length} tickets</span>
                </>
              )}
              <span className="stat-go">View open tickets</span>
            </Link>
          </div>

          {failed.length > 0 && (
            <div className="dash-unavailable-row">
              {failed.map((k) => (
                <Unavailable key={k} what={k} onRetry={retryOne(k)} />
              ))}
            </div>
          )}

          <div className="dashboard-grid">
            <section className="card">
              <h3>Deals by stage</h3>
              <span className="range-chip">Deals created in the {rangeLabel.toLowerCase()}</span>
              {isFailed('deals') ? <Unavailable what="deals" onRetry={retryOne('deals')} /> : <BarChart data={dealsByStage} />}
            </section>
            <section className="card">
              <h3>Leads by status</h3>
              <span className="range-chip">{rangeLabel}</span>
              {isFailed('leads') ? <Unavailable what="leads" onRetry={retryOne('leads')} /> : <DonutChart data={leadsByStatus} />}
            </section>
            <section className="card" data-testid="won-revenue">
              <h3>Won revenue</h3>
              <span className="range-chip">{rangeLabel}</span>
              {isFailed('deals') ? (
                <Unavailable what="deals" onRetry={retryOne('deals')} />
              ) : (
                <>
                  <p className="stat-value">{formatMoney(wonRevenue)}</p>
                  <p className="stat-hint">
                    {wonDeals.length} deals closed won. Previous {days} days: {formatMoney(previousWon)}.
                  </p>
                </>
              )}
            </section>
            <section className="card activity-card">
              <h3>Recent activity</h3>
              <span className="range-chip now">Latest first</span>
              {isFailed('activities') ? (
                <Unavailable what="activities" onRetry={retryOne('activities')} />
              ) : (
                <div className="activity-feed" ref={feedRef} onScroll={handleFeedScroll} data-testid="activity-feed">
                  {activities.slice(0, visibleActivities).map((a) => (
                    <div key={a.id} className="activity-item">
                      <span className="activity-icon">{a.icon}</span>
                      <span className="activity-text">{a.text}</span>
                      <span className="activity-time">{timeAgo(a.when)}</span>
                    </div>
                  ))}
                  {visibleActivities >= activities.length && <div className="search-hint">You're all caught up.</div>}
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
