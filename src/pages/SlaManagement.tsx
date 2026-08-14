import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAll, upsert } from '../data/store';
import { SlaConfig } from '../types';
import { SkeletonRows } from '../components/Spinner';
import { useToast } from '../components/Toast';
import { useAuth } from '../auth/AuthContext';

const PRIORITY_ORDER: SlaConfig['priority'][] = ['Urgent', 'High', 'Medium', 'Low'];

export function SlaManagement() {
  const toast = useToast();
  const { user } = useAuth();
  const readOnly = user?.role !== 'admin';

  const [loading, setLoading] = useState(true);
  const [configs, setConfigs] = useState<SlaConfig[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    const data = await getAll<SlaConfig>('slaConfigs');
    setConfigs(data);
    setDrafts(Object.fromEntries(data.map((c) => [c.id, String(c.hours)])));
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const save = async (config: SlaConfig) => {
    const hours = Number(drafts[config.id]);
    if (!Number.isFinite(hours) || hours <= 0) {
      toast.push('error', 'Enter a valid number of hours.');
      return;
    }
    setBusyId(config.id);
    await upsert('slaConfigs', { ...config, hours });
    setBusyId(null);
    toast.push('success', `${config.priority} SLA set to ${hours}h.`);
    load();
  };

  const ordered = PRIORITY_ORDER.map((p) => configs.find((c) => c.priority === p)).filter((c): c is SlaConfig => Boolean(c));

  return (
    <div data-testid="sla-management-page">
      <nav className="breadcrumbs">
        <Link to="/setup">Setup</Link> <span>/</span> <span>SLA Management</span>
      </nav>
      <div className="page-header">
        <h1>SLA Management</h1>
      </div>
      <p className="muted">
        Hours-to-resolve per priority — a new ticket's SLA countdown is stamped from this at creation time.
      </p>

      {loading ? (
        <SkeletonRows rows={4} />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Priority</th>
                <th className="num">Hours</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {ordered.map((config) => (
                <tr key={config.id}>
                  <td>
                    <span className={`pill priority-${config.priority.toLowerCase()}`}>{config.priority}</span>
                  </td>
                  <td className="num">
                    <input
                      className="input"
                      type="number"
                      min={1}
                      style={{ maxWidth: 100, marginLeft: 'auto' }}
                      disabled={readOnly}
                      data-testid={`sla-hours-${config.priority.toLowerCase()}`}
                      value={drafts[config.id] ?? ''}
                      onChange={(e) => setDrafts({ ...drafts, [config.id]: e.target.value })}
                    />
                  </td>
                  <td>
                    <button
                      className="btn btn-small"
                      disabled={readOnly || busyId === config.id}
                      onClick={() => save(config)}
                    >
                      Save
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
