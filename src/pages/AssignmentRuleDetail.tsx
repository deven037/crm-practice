import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Pencil, Trash2 } from 'lucide-react';
import { getAllSync, getById, removeMany } from '../data/store';
import { AssignmentRule, User } from '../types';
import { Modal } from '../components/Modal';
import { Spinner } from '../components/Spinner';
import { useToast } from '../components/Toast';
import { getConditionFields } from '../utils/moduleFields';

const MODULE_LABELS: Record<AssignmentRule['module'], string> = { leads: 'Leads', contacts: 'Contacts', deals: 'Deals' };

export function AssignmentRuleDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [rule, setRule] = useState<AssignmentRule | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    (async () => {
      const r = await getById<AssignmentRule>('assignmentRules', id ?? '');
      if (!r) setNotFound(true);
      else setRule(r);
    })();
  }, [id]);

  if (notFound) {
    return (
      <div className="empty-cell">
        Rule not found. <Link to="/setup/assignment-rules">Back to Assignment Rules</Link>
      </div>
    );
  }
  if (!rule) return <Spinner label="Loading rule…" />;

  const users = getAllSync<User>('users');
  const assignee = users.find((u) => u.id === rule.assignTo)?.name ?? '—';
  const fields = getConditionFields(rule.module);
  const fieldLabel = (key: string) => fields.find((f) => f.key === key)?.label ?? key;

  const doDelete = async () => {
    await removeMany('assignmentRules', [rule.id]);
    toast.push('success', `Rule "${rule.name}" deleted.`);
    navigate('/setup/assignment-rules');
  };

  return (
    <div data-testid="assignment-rule-detail-page">
      <nav className="breadcrumbs">
        <Link to="/setup">Setup</Link> <span>/</span> <Link to="/setup/assignment-rules">Assignment Rules</Link>{' '}
        <span>/</span> <span>{rule.name}</span>
      </nav>
      <div className="page-header">
        <h1>{rule.name}</h1>
        <div className="page-actions">
          <span className={`pill ${rule.active ? 'status-converted' : 'status-unqualified'}`}>{rule.active ? 'Active' : 'Inactive'}</span>
          <button className="btn" onClick={() => navigate(`/setup/assignment-rules/${rule.id}/edit`)}>
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
          <dt>Assign to</dt>
          <dd>{assignee}</dd>
          <dt>Priority</dt>
          <dd>{rule.priority}</dd>
        </dl>
      </div>

      <div className="card">
        <h3>Conditions</h3>
        {rule.conditions.length === 0 ? (
          <p className="muted">No conditions — this rule never matches.</p>
        ) : (
          <ul className="file-list">
            {rule.conditions.map((c, i) => (
              <li key={i}>
                <strong>{fieldLabel(c.field)}</strong> {c.operator} <code>{c.value || '(empty)'}</code>
              </li>
            ))}
          </ul>
        )}
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
