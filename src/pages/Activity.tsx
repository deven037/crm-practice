import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAll } from '../data/store';
import { Activity } from '../types';
import { timeAgo } from '../utils';

const LOAD_TIMEOUT_MS = 10_000;
const BANK_NAME = import.meta.env.VITE_BANK_NAME?.trim() || 'Your bank';

function loadActivities(): Promise<Activity[]> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error('Activity request timed out')), LOAD_TIMEOUT_MS);
    getAll<Activity>('activities').then(
      (items) => {
        window.clearTimeout(timeout);
        resolve(items);
      },
      (error: unknown) => {
        window.clearTimeout(timeout);
        reject(error);
      }
    );
  });
}

export function ActivityPage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setActivities(await loadActivities());
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="activity-screen">
      <a className="activity-skip" href="#activity-content">Skip to activity</a>
      <div className="activity-header">
        <div>
          <h1>Activity</h1>
          <p className="activity-intro">Recent changes across your leads, deals, tasks and tickets.</p>
        </div>
        <div className="activity-bank">{BANK_NAME}</div>
      </div>

      <section id="activity-content" className="activity-content" aria-labelledby="activity-feed-title" tabIndex={-1}>
        <div className="activity-feed-heading">
          <h2 id="activity-feed-title">Latest activity</h2>
          <span>Latest first</span>
        </div>

        {loading ? (
          <div className="activity-loading" role="status" aria-busy="true">
            <span className="activity-sr">Loading recent activity</span>
            <div className="activity-skeleton" aria-hidden="true" />
            <div className="activity-skeleton short" aria-hidden="true" />
            <div className="activity-skeleton" aria-hidden="true" />
            <div className="activity-skeleton mid" aria-hidden="true" />
          </div>
        ) : failed ? (
          <div className="activity-error" role="alert">
            <p>We couldn’t load recent activity. Try again.</p>
            <button type="button" className="btn btn-primary activity-retry" onClick={() => void load()}>
              Retry
            </button>
          </div>
        ) : activities.length === 0 ? (
          <div className="activity-empty">
            <p>No activity yet</p>
            <p className="muted">Activity will appear here as your team updates records.</p>
            <p className="muted">There are no recent changes to show.</p>
          </div>
        ) : (
          <ol className="activity-timeline" aria-label="Recent activity, latest first">
            {activities.map((activity) => (
              <li className="activity-entry" key={activity.id}>
                <p>{activity.text}</p>
                <span className="activity-relative-time">{timeAgo(activity.when)}</span>
              </li>
            ))}
          </ol>
        )}

        {!loading && !failed && (
          <div className="activity-footer">
            <span>Showing the activity available in Recent activity.</span>
            <Link className="activity-back" to="/dashboard">Back to Dashboard</Link>
          </div>
        )}
      </section>
    </div>
  );
}
