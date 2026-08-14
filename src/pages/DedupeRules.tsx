import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getAll, removeMany } from '../data/store';
import { DedupeRule, DedupeRuleModule } from '../types';
import { TemplateGallery } from '../components/TemplateGallery';
import { SkeletonRows } from '../components/Spinner';
import { useToast } from '../components/Toast';
import { useAuth } from '../auth/AuthContext';

const MODULE_OPTIONS: { value: DedupeRuleModule; label: string }[] = [
  { value: 'leads', label: 'Leads' },
  { value: 'contacts', label: 'Contacts' },
];

export function DedupeRules() {
  const toast = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  const readOnly = user?.role !== 'admin';

  const [loading, setLoading] = useState(true);
  const [rules, setRules] = useState<DedupeRule[]>([]);

  const load = async () => {
    setRules(await getAll<DedupeRule>('dedupeRules'));
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const remove = async (rule: DedupeRule) => {
    if (!window.confirm(`Delete dedupe rule "${rule.name}"?`)) return;
    await removeMany('dedupeRules', [rule.id]);
    toast.push('success', `Rule "${rule.name}" deleted.`);
    load();
  };

  return (
    <div data-testid="dedupe-rules-page">
      <nav className="breadcrumbs">
        <Link to="/setup">Setup</Link> <span>/</span> <span>Dedupe Rule</span>
      </nav>
      <div className="page-header">
        <h1>Dedupe Rule</h1>
      </div>
      <p className="muted">
        Active rules power the non-blocking duplicate warning shown while creating a lead or contact — matching on the
        fields below.
      </p>

      {loading ? (
        <SkeletonRows rows={3} />
      ) : (
        <TemplateGallery
          items={rules.map((r) => ({
            id: r.id,
            name: r.name,
            meta: `${MODULE_OPTIONS.find((m) => m.value === r.module)?.label} · ${r.matchFields.join(', ')} · ${r.matchType} · ${r.active ? 'Active' : 'Inactive'}`,
            onClick: () => navigate(`/setup/dedupe-rules/${r.id}`),
            rows: readOnly ? [] : [{ label: 'Delete', onClick: () => remove(r) }],
          }))}
          createLabel="New Rule"
          createHint="Warn when a new record matches an existing one."
          onCreate={() => !readOnly && navigate('/setup/dedupe-rules/new')}
        />
      )}
    </div>
  );
}
