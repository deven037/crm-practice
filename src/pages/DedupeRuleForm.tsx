import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getById, newId, upsert } from '../data/store';
import { DedupeMatchType, DedupeRule, DedupeRuleModule } from '../types';
import { Select, MultiSelect } from '../components/Select';
import { Spinner } from '../components/Spinner';
import { useToast } from '../components/Toast';
import { getAllModuleFields } from '../utils/moduleFields';

const MODULE_OPTIONS: { value: DedupeRuleModule; label: string }[] = [
  { value: 'leads', label: 'Leads' },
  { value: 'contacts', label: 'Contacts' },
];

const MATCH_TYPE_OPTIONS: { value: DedupeMatchType; label: string }[] = [
  { value: 'exact', label: 'Exact match' },
  { value: 'fuzzy', label: 'Fuzzy (contains)' },
];

function emptyRule(): DedupeRule {
  return { id: newId('deduperule'), module: 'leads', name: '', active: true, matchFields: ['email'], matchType: 'exact' };
}

export function DedupeRuleForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const isNew = !id || id === 'new';

  const [loading, setLoading] = useState(!isNew);
  const [notFound, setNotFound] = useState(false);
  const [rule, setRule] = useState<DedupeRule>(emptyRule());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isNew) return;
    (async () => {
      const r = await getById<DedupeRule>('dedupeRules', id ?? '');
      if (!r) setNotFound(true);
      else setRule(r);
      setLoading(false);
    })();
  }, [id, isNew]);

  if (notFound) {
    return (
      <div className="empty-cell">
        Rule not found. <Link to="/setup/dedupe-rules">Back to Dedupe Rule</Link>
      </div>
    );
  }
  if (loading) return <Spinner label="Loading rule…" />;

  const fieldOptions = getAllModuleFields(rule.module).map((f) => ({ value: f.key, label: f.label + (f.isCustom ? ' (custom)' : '') }));

  const save = async () => {
    if (!rule.name.trim() || rule.matchFields.length === 0) {
      toast.push('error', 'Name and at least one match field are required.');
      return;
    }
    setBusy(true);
    await upsert('dedupeRules', { ...rule, name: rule.name.trim() });
    setBusy(false);
    toast.push('success', `Rule "${rule.name}" saved.`);
    navigate(isNew ? '/setup/dedupe-rules' : `/setup/dedupe-rules/${rule.id}`);
  };

  return (
    <div data-testid="dedupe-rule-form-page">
      <nav className="breadcrumbs">
        <Link to="/setup">Setup</Link> <span>/</span> <Link to="/setup/dedupe-rules">Dedupe Rule</Link> <span>/</span>{' '}
        <span>{isNew ? 'New rule' : rule.name}</span>
      </nav>
      <div className="page-header">
        <h1>{isNew ? 'New dedupe rule' : `Edit rule — ${rule.name}`}</h1>
        <div className="page-actions">
          <button className="btn" onClick={() => navigate(isNew ? '/setup/dedupe-rules' : `/setup/dedupe-rules/${rule.id}`)}>
            Cancel
          </button>
          <button className="btn btn-primary" data-testid="dedupe-rule-save-btn" disabled={busy} onClick={save}>
            {busy ? 'Saving…' : 'Save rule'}
          </button>
        </div>
      </div>

      <div className="card form-card">
        <div className="form-grid">
          <div className="field">
            <span className="field-label">Name *</span>
            <input
              className="input"
              data-testid="dedupe-rule-name"
              value={rule.name}
              onChange={(e) => setRule({ ...rule, name: e.target.value })}
            />
          </div>
          <div className="field">
            <span className="field-label">Module</span>
            <Select
              value={rule.module}
              options={MODULE_OPTIONS}
              onChange={(v) => setRule({ ...rule, module: v as DedupeRuleModule, matchFields: [] })}
              testId="dedupe-rule-module"
            />
          </div>
          <div className="field">
            <span className="field-label">Match on fields *</span>
            <MultiSelect
              values={rule.matchFields}
              options={fieldOptions}
              onChange={(v) => setRule({ ...rule, matchFields: v })}
              placeholder="Choose fields…"
              testId="dedupe-rule-fields"
            />
          </div>
          <div className="field">
            <span className="field-label">Match type</span>
            <Select
              value={rule.matchType}
              options={MATCH_TYPE_OPTIONS}
              onChange={(v) => setRule({ ...rule, matchType: v as DedupeMatchType })}
            />
          </div>
        </div>
        <label className="checkbox-label">
          <input type="checkbox" checked={rule.active} onChange={(e) => setRule({ ...rule, active: e.target.checked })} />
          Active
        </label>
      </div>
    </div>
  );
}
