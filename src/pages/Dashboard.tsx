import { useEffect, useMemo, useRef, useState } from 'react';
import { getAll } from '../data/store';
import { Activity, Deal, DEAL_STAGES, Lead, LEAD_STATUSES, TaskItem, Ticket } from '../types';
import { BarChart, DonutChart, LineChart } from '../components/charts';
import { Select } from '../components/Select';
import { SkeletonRows } from '../components/Spinner';
import { useToast } from '../components/Toast';
import { useAuth } from '../auth/AuthContext';
import { formatCurrency, timeAgo } from '../utils';

const RANGES = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: '365', label: 'Last year' },
];

const PAGE_SIZE = 12;

export function Dashboard() {
  const { user } = useAuth();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [range, setRange] = useState('30');
  const [visibleActivities, setVisibleActivities] = useState(PAGE_SIZE);
  const [feedLoading, setFeedLoading] = useState(false);
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [l, d, t, tk, a] = await Promise.all([
        getAll<Lead>('leads'),
        getAll<Deal>('deals'),
        getAll<TaskItem>('tasks'),
        getAll<Ticket>('tickets'),
        getAll<Activity>('activities'),
      ]);
      if (cancelled) return;
      setLeads(l);
      setDeals(d);
      setTasks(t);
      setTickets(tk);
      setActivities(a);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    // Welcome toast once per browser session — an auto-appearing element to handle in tests.
    if (user && !sessionStorage.getItem('crm.welcomed')) {
      sessionStorage.setItem('crm.welcomed', '1');
      toast.push('info', `Welcome back, ${user.name.split(' ')[0]}!`);
    }
  }, [user, toast]);

  const cutoff = Date.now() - Number(range) * 24 * 60 * 60 * 1000;
  const rangedLeads = useMemo(() => leads.filter((l) => new Date(l.createdAt).getTime() >= cutoff), [leads, cutoff]);
  const rangedDeals = useMemo(() => deals.filter((d) => new Date(d.createdAt).getTime() >= cutoff), [deals, cutoff]);

  const openPipeline = deals
    .filter((d) => !d.stage.startsWith('Closed'))
    .reduce((sum, d) => sum + d.amount, 0);
  const dueToday = tasks.filter((t) => {
    if (t.completed) return false;
    const due = new Date(t.dueDate);
    const today = new Date();
    return due.toDateString() === today.toDateString();
  }).length;
  const openTickets = tickets.filter((t) => t.status === 'Open' || t.status === 'In Progress').length;

  const dealsByStage = DEAL_STAGES.map((stage) => ({
    label: stage.replace('Closed ', ''),
    value: rangedDeals.filter((d) => d.stage === stage).length,
  }));
  const leadsByStatus = LEAD_STATUSES.filter((s) => s !== 'Converted').map((status) => ({
    label: status,
    value: rangedLeads.filter((l) => l.status === status).length,
  }));

  const revenueByMonth = useMemo(() => {
    const months: { label: string; value: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const label = d.toLocaleDateString('en-US', { month: 'short' });
      const value = deals
        .filter((deal) => {
          if (deal.stage !== 'Closed Won') return false;
          const cd = new Date(deal.closeDate);
          return cd.getMonth() === d.getMonth() && cd.getFullYear() === d.getFullYear();
        })
        .reduce((sum, deal) => sum + deal.amount, 0);
      months.push({ label, value: Math.round(value / 1000) });
    }
    return months;
  }, [deals]);

  const handleFeedScroll = () => {
    const el = feedRef.current;
    if (!el || feedLoading || visibleActivities >= activities.length) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 60) {
      setFeedLoading(true);
      setTimeout(() => {
        setVisibleActivities((v) => v + PAGE_SIZE);
        setFeedLoading(false);
      }, 700);
    }
  };

  return (
    <div data-testid="dashboard-page">
      <div className="page-header">
        <h1>Dashboard</h1>
        <div className="page-actions">
          <Select value={range} options={RANGES} onChange={setRange} testId="dashboard-range" />
        </div>
      </div>

      {loading ? (
        <SkeletonRows rows={8} />
      ) : (
        <>
          <div className="stat-grid">
            <div className="stat-tile" data-testid="stat-leads">
              <span className="stat-label">Total leads</span>
              <span className="stat-value">{leads.length}</span>
              <span className="stat-hint">{rangedLeads.length} in selected range</span>
            </div>
            <div className="stat-tile" data-testid="stat-pipeline">
              <span className="stat-label">Open pipeline</span>
              <span className="stat-value">{formatCurrency(openPipeline)}</span>
              <span className="stat-hint">{deals.filter((d) => !d.stage.startsWith('Closed')).length} open deals</span>
            </div>
            <div className="stat-tile" data-testid="stat-tasks">
              <span className="stat-label">Tasks due today</span>
              <span className="stat-value">{dueToday}</span>
              <span className="stat-hint">{tasks.filter((t) => !t.completed).length} open total</span>
            </div>
            <div className="stat-tile" data-testid="stat-tickets">
              <span className="stat-label">Open tickets</span>
              <span className="stat-value">{openTickets}</span>
              <span className="stat-hint">of {tickets.length} total</span>
            </div>
          </div>

          <div className="dashboard-grid">
            <section className="card">
              <h3>Deals by stage</h3>
              <BarChart data={dealsByStage} />
            </section>
            <section className="card">
              <h3>Leads by status</h3>
              <DonutChart data={leadsByStatus} />
            </section>
            <section className="card">
              <h3>Won revenue ($k, last 6 months)</h3>
              <LineChart data={revenueByMonth} />
            </section>
            <section className="card activity-card">
              <h3>Recent activity</h3>
              <div className="activity-feed" ref={feedRef} onScroll={handleFeedScroll} data-testid="activity-feed">
                {activities.slice(0, visibleActivities).map((a) => (
                  <div key={a.id} className="activity-item">
                    <span className="activity-icon">{a.icon}</span>
                    <span className="activity-text">{a.text}</span>
                    <span className="activity-time">{timeAgo(a.when)}</span>
                  </div>
                ))}
                {feedLoading && <div className="search-hint">Loading more…</div>}
                {visibleActivities >= activities.length && <div className="search-hint">You're all caught up 🎉</div>}
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
