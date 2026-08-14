import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getAll, removeMany } from '../data/store';
import { AssignmentRule, AssignmentRuleModule } from '../types';
import { TemplateGallery } from '../components/TemplateGallery';
import { SkeletonRows } from '../components/Spinner';
import { useToast } from '../components/Toast';
import { useAuth } from '../auth/AuthContext';

const MODULE_OPTIONS: { value: AssignmentRuleModule; label: string }[] = [
  { value: 'leads', label: 'Leads' },
  { value: 'contacts', label: 'Contacts' },
  { value: 'deals', label: 'Deals' },
];

export function AssignmentRules() {
  const toast = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  const readOnly = user?.role !== 'admin';

  const [loading, setLoading] = useState(true);
  const [rules, setRules] = useState<AssignmentRule[]>([]);

  const load = async () => {
    setRules(await getAll<AssignmentRule>('assignmentRules'));
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const remove = async (rule: AssignmentRule) => {
    if (!window.confirm(`Delete assignment rule "${rule.name}"?`)) return;
    await removeMany('assignmentRules', [rule.id]);
    toast.push('success', `Rule "${rule.name}" deleted.`);
    load();
  };

  return (
    <div data-testid="assignment-rules-page">
      <nav className="breadcrumbs">
        <Link to="/setup">Setup</Link> <span>/</span> <span>Assignment Rules</span>
      </nav>
      <div className="page-header">
        <h1>Assignment Rules</h1>
      </div>
      <p className="muted">
        When a new lead is created, the first active rule (lowest priority number first) whose conditions match sets
        its owner automatically.
      </p>

      {loading ? (
        <SkeletonRows rows={3} />
      ) : (
        <TemplateGallery
          items={rules.map((r) => ({
            id: r.id,
            name: r.name,
            meta: `${MODULE_OPTIONS.find((m) => m.value === r.module)?.label} · Priority ${r.priority} · ${r.active ? 'Active' : 'Inactive'}`,
            onClick: () => navigate(`/setup/assignment-rules/${r.id}`),
            rows: readOnly ? [] : [{ label: 'Delete', onClick: () => remove(r) }],
          }))}
          createLabel="New Rule"
          createHint="Auto-assign new records based on field conditions."
          onCreate={() => !readOnly && navigate('/setup/assignment-rules/new')}
        />
      )}
    </div>
  );
}
