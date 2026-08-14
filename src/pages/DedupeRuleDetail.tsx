import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Pencil, Trash2 } from 'lucide-react';
import { getById, removeMany } from '../data/store';
import { DedupeRule } from '../types';
import { Modal } from '../components/Modal';
import { Spinner } from '../components/Spinner';
import { useToast } from '../components/Toast';
import { getAllModuleFields } from '../utils/moduleFields';

const MODULE_LABELS: Record<DedupeRule['module'], string> = { leads: 'Leads', contacts: 'Contacts' };

export function DedupeRuleDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [rule, setRule] = useState<DedupeRule | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    (async () => {
      const r = await getById<DedupeRule>('dedupeRules', id ?? '');
      if (!r) setNotFound(true);
      else setRule(r);
    })();
  }, [id]);

  if (notFound) {
    return (
      <div className="empty-cell">
        Rule not found. <Link to="/setup/dedupe-rules">Back to Dedupe Rule</Link>
      </div>
    );
  }
  if (!rule) return <Spinner label="Loading rule…" />;

  const fields = getAllModuleFields(rule.module);
  const fieldLabel = (key: string) => fields.find((f) => f.key === key)?.label ?? key;

  const doDelete = async () => {
    await removeMany('dedupeRules', [rule.id]);
    toast.push('success', `Rule "${rule.name}" deleted.`);
    navigate('/setup/dedupe-rules');
  };

  return (
    <div data-testid="dedupe-rule-detail-page">
      <nav className="breadcrumbs">
        <Link to="/setup">Setup</Link> <span>/</span> <Link to="/setup/dedupe-rules">Dedupe Rule</Link> <span>/</span>{' '}
        <span>{rule.name}</span>
      </nav>
      <div className="page-header">
        <h1>{rule.name}</h1>
        <div className="page-actions">
          <span className={`pill ${rule.active ? 'status-converted' : 'status-unqualified'}`}>{rule.active ? 'Active' : 'Inactive'}</span>
          <button className="btn" onClick={() => navigate(`/setup/dedupe-rules/${rule.id}/edit`)}>
            <Pencil size={14} /> Edit
          </button>
          <button className="btn btn-danger" onClick={() => setDeleting(true)}>
            <Trash2 size={14} /> Delete
          </button>
        </div>
      </div>

      <div className="card">
        <dl className="detail-list">
          <dt>Module</dt>
          <dd>{MODULE_LABELS[rule.module]}</dd>
          <dt>Match type</dt>
          <dd>{rule.matchType === 'exact' ? 'Exact match' : 'Fuzzy (contains)'}</dd>
          <dt>Match fields</dt>
          <dd>{rule.matchFields.map(fieldLabel).join(', ') || '—'}</dd>
        </dl>
      </div>

      {deleting && (
        <Modal
          title={`Delete rule — ${rule.name}`}
          onClose={() => setDeleting(false)}
          footer={
            <>
              <button className="btn" onClick={() => setDeleting(false)}>
                Cancel
              </button>
              <button className="btn btn-danger" data-testid="confirm-delete-btn" onClick={doDelete}>
                Delete rule
              </button>
            </>
          }
        >
          <p>Delete “{rule.name}”? This cannot be undone.</p>
        </Modal>
      )}
    </div>
  );
}
