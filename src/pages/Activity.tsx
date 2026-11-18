import { CSSProperties, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, Plus, Search, X } from 'lucide-react';
import { getAll } from '../data/store';
import { Activity, User } from '../types';
import { SkeletonRows } from '../components/Spinner';
import { ToolBoxMenu } from '../components/ToolBoxMenu';
import { useAuth } from '../auth/AuthContext';
import { TagPicker } from './contacts/contactBits';
import { ACTIVITY_TOOLBOX_LINKS, canManageTasks } from './Tasks';
import { activityType, addDays, countBy, dayLabel, dayOffset, heatCells, heatLevel, relativeDay, startOfDay, weekStart } from './activity/activityLogic';
import { Face, FeedEntry, hue, typeStyle } from './activity/activityBits';

const LOAD_TIMEOUT_MS = 10_000;
const PAGE = 40;

function loadActivities(): Promise<Activity[]> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error('Activity request timed out')), LOAD_TIMEOUT_MS);
    getAll<Activity>('activities').then(
      (items) => { window.clearTimeout(timeout); resolve(items); },
      (error: unknown) => { window.clearTimeout(timeout); reject(error); },
    );
  });
}

interface ActivityViewProps {
  loading: boolean;
  failed: boolean;
  activities: Activity[];
  users?: User[];
  canLog?: boolean;
  onRetry: () => void;
  now?: Date;
}

/** The Activity page without its data loading, so it can be tested on its own. */
export function ActivityView({ loading, failed, activities, users = [], canLog = false, onRetry, now = new Date() }: ActivityViewProps) {
  const [query, setQuery] = useState('');
  const [types, setTypes] = useState<string[]>([]);
  const [people, setPeople] = useState<string[]>([]);
  const [day, setDay] = useState<number | null>(null);
  const [limit, setLimit] = useState(PAGE);

  const sorted = [...activities].sort((a, b) => b.when.localeCompare(a.when));
  const cells = heatCells(sorted, now);
  const since = cells[0]?.date ?? now;
  const inRange = sorted.filter((a) => new Date(a.when) >= since);
  const byType = countBy(inRange, activityType);
  const total = inRange.length;
  const byWeekday = [0, 0, 0, 0, 0, 0, 0];
  cells.forEach((c, i) => { if (c.count > 0) byWeekday[i % 7] += c.count; });
  const busiest = total ? ['Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays', 'Sundays'][byWeekday.indexOf(Math.max(...byWeekday))] : '';
  const thisWeek = sorted.filter((a) => new Date(a.when) >= weekStart(now));
  const whoOf = (a: Activity) => a.userName || (a.text.match(/^(\S+\s\S+)/)?.[1] ?? 'Someone');
  const byPerson = countBy(thisWeek, whoOf).slice(0, 5);
  const mostPerson = Math.max(1, ...byPerson.map(([, n]) => n));
  const allTypes = [...new Set(sorted.map(activityType))].sort();
  const allPeople = [...new Set(sorted.map(whoOf))].sort();
  const q = query.trim().toLowerCase();
  const shown = sorted.filter((a) =>
    (!types.length || types.includes(activityType(a))) &&
    (!people.length || people.includes(whoOf(a))) &&
    (day == null || dayOffset(a.when, now) === day) &&
    (!q || `${a.text} ${a.notes ?? ''} ${a.recordName ?? ''}`.toLowerCase().includes(q)));
  const visible = shown.slice(0, limit);
  const groups: [number, Activity[]][] = [];
  for (const a of visible) {
    const off = dayOffset(a.when, now);
    const last = groups[groups.length - 1];
    if (last && last[0] === off) last[1].push(a);
    else groups.push([off, [a]]);
  }
  const filtering = q !== '' || types.length > 0 || people.length > 0 || day != null;
  const clear = () => { setQuery(''); setTypes([]); setPeople([]); setDay(null); setLimit(PAGE); };
  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  return (
    <div className="act3 act-pulse" data-testid="activity-page">
      <a className="activity-skip" href="#activity-content">Skip to activity</a>
      <div className="page-header">
        <div>
          <h1>Activity</h1>
          <p className="page-subtitle">What your team did with customers, newest first.</p>
        </div>
        <div className="page-actions">
          <ToolBoxMenu links={ACTIVITY_TOOLBOX_LINKS} />
          {canLog && <Link className="btn btn-primary contacts-primary" data-testid="log-activity" to="/activity/new"><Plus size={16} /> Log activity</Link>}
        </div>
      </div>

      {loading ? (
        <div className="activity-loading" role="status" aria-busy="true">
          <span className="sr-only">Loading recent activity</span>
          <SkeletonRows rows={6} />
        </div>
      ) : failed ? (
        <div className="banner banner-error contacts-error" role="alert">
          <p>We couldn’t load recent activity. Try again.</p>
          <button type="button" className="btn" onClick={onRetry}>Retry</button>
        </div>
      ) : (
        <>
          <div className="act-pulse-top">
            <section className="card act-heatcard" aria-label="Activity per day, last 12 weeks">
              <span className="act-eyebrow">Last 12 weeks</span>
              <div className="act-heatsum"><b>{total}</b> {total === 1 ? 'activity' : 'activities'}{busiest && <> · busiest on <b>{busiest}</b></>}</div>
              <div className="act-heatwrap">
                <div className="act-heatdays" aria-hidden="true"><span>Mon</span><span /><span>Wed</span><span /><span>Fri</span><span /><span>Sun</span></div>
                <div className="act-heat" role="group" aria-label="Activity per day">
                  {cells.map((c, i) => c.count < 0 ? <i key={i} className="act-hc fut" /> : (
                    <button
                      key={i}
                      type="button"
                      className={`act-hc l${heatLevel(c.count)}`}
                      aria-pressed={day === c.offset}
                      title={`${dayLabel(c.date)}: ${c.count} ${c.count === 1 ? 'activity' : 'activities'}`}
                      aria-label={`${dayLabel(c.date)}, ${c.count} ${c.count === 1 ? 'activity' : 'activities'}`}
                      style={{ animationDelay: `${(i % 7) * 30 + Math.floor(i / 7) * 25}ms` }}
                      onClick={() => { setDay(day === c.offset ? null : c.offset); setLimit(PAGE); }}
                    />
                  ))}
                </div>
              </div>
              <div className="act-heatlegend"><span>Click a day to see it</span><span className="act-scale">Less <i className="act-hc" /><i className="act-hc l1" /><i className="act-hc l2" /><i className="act-hc l3" /><i className="act-hc l4" /> More</span></div>
            </section>
            <section className="card act-mixcard" aria-label="Activity by type and by person">
              <span className="act-eyebrow">By type</span>
              <div className="act-mixbar">{byType.map(([t, n], i) => <i key={t} style={{ ...hue(typeStyle(t).hue), width: `${(n / Math.max(1, total)) * 100}%`, animationDelay: `${150 + i * 80}ms` } as CSSProperties} />)}</div>
              <div className="act-mixlist">
                {byType.length === 0 && <span className="muted">Nothing logged in the last 12 weeks.</span>}
                {byType.map(([t, n]) => (
                  <button key={t} type="button" aria-pressed={types.includes(t)} onClick={() => setTypes((list) => toggle(list, t))}>
                    <i style={{ background: typeStyle(t).hue }} /><span>{t}</span><b>{n}</b>
                  </button>
                ))}
              </div>
              <span className="act-eyebrow act-gap">This week by person</span>
              <div className="act-ppl">
                {byPerson.length === 0 && <span className="muted">Nothing logged this week yet.</span>}
                {byPerson.map(([name, n]) => {
                  const u = users.find((x) => x.name === name);
                  return (
                    <button key={name} type="button" aria-pressed={people.includes(name)} onClick={() => setPeople((list) => toggle(list, name))}>
                      <Face id={u?.id ?? name} name={name} small /><span>{name}</span><i style={{ '--w': `${(n / mostPerson) * 100}%` } as CSSProperties} /><b>{n}</b>
                    </button>
                  );
                })}
              </div>
            </section>
          </div>

          <div className="toolbar contact-tools">
            <div className="contact-find">
              <Search size={17} aria-hidden="true" />
              <input type="search" className="input search-input" aria-label="Search activity" placeholder="Search notes, people and records…" value={query} onChange={(e) => { setQuery(e.target.value); setLimit(PAGE); }} />
            </div>
            <TagPicker testId="activity-type-filter" label={<>Type{types.length ? ` · ${types.length}` : ''} <ChevronDown size={14} aria-hidden="true" /></>} tags={allTypes} selected={types} onToggle={(t) => setTypes((list) => toggle(list, t))} />
            <TagPicker testId="activity-people-filter" label={<>People{people.length ? ` · ${people.length}` : ''} <ChevronDown size={14} aria-hidden="true" /></>} tags={allPeople} selected={people} onToggle={(p) => setPeople((list) => toggle(list, p))} />
            {day != null && <span className="act-daychip">{dayLabel(addDays(startOfDay(now), day))}<button type="button" aria-label="Show every day" onClick={() => setDay(null)}><X size={13} /></button></span>}
            {filtering && <button type="button" className="btn btn-ghost" onClick={clear}>Clear</button>}
          </div>

          <section id="activity-content" className="card act-feed" aria-label="Recent activity, latest first" tabIndex={-1}>
            {activities.length === 0 ? (
              <div className="act-cele"><b>No activity yet</b>Activity will appear here as your team logs calls, meetings and notes.</div>
            ) : groups.length === 0 ? (
              <div className="act-cele"><b>Nothing here</b>{day != null ? 'Nothing was logged that day.' : 'No activity matches these filters.'}</div>
            ) : groups.map(([off, list]) => (
              <div key={off}>
                <div className="act-fday">{relativeDay(addDays(startOfDay(now), off), now)}<small>{list.length} {list.length === 1 ? 'entry' : 'entries'}</small></div>
                {list.map((a, i) => <FeedEntry key={a.id} activity={a} last={i === list.length - 1} delay={Math.min(i, 10) * 35} />)}
              </div>
            ))}
            {shown.length > visible.length && (
              <div className="act-showmore"><button type="button" className="btn" onClick={() => setLimit((n) => n + PAGE)}>Show {Math.min(PAGE, shown.length - visible.length)} more</button></div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

export function ActivityPage() {
  const { user } = useAuth();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [a, u] = await Promise.all([loadActivities(), getAll<User>('users').catch((): User[] => [])]);
      setActivities([...a]);
      setUsers(u);
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return <ActivityView loading={loading} failed={failed} activities={activities} users={users} canLog={canManageTasks(user?.role)} onRetry={() => void load()} />;
}
