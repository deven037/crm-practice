import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getAllSync, getById, newId, upsert } from '../data/store';
import { AssignmentRule, AssignmentRuleModule, RuleOperator, User } from '../types';
import { Select } from '../components/Select';
import { Spinner } from '../components/Spinner';
import { useToast } from '../components/Toast';
import { getConditionFields, ModuleFieldDef } from '../utils/moduleFields';

const MODULE_OPTIONS: { value: AssignmentRuleModule; label: string }[] = [
  { value: 'leads', label: 'Leads' },
  { value: 'contacts', label: 'Contacts' },
  { value: 'deals', label: 'Deals' },
];

const OPERATOR_OPTIONS: { value: RuleOperator; label: string }[] = [
  { value: 'equals', label: 'equals' },
  { value: 'contains', label: 'contains' },
];

function emptyRule(): AssignmentRule {
  return {
    id: newId('assignrule'),
    module: 'leads',
    name: '',
    active: true,
    conditions: [{ field: 'source', operator: 'equals', value: '' }],
    assignTo: '',
    priority: 1,
  };
}

export function AssignmentRuleForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const isNew = !id || id === 'new';
  const users = getAllSync<User>('users');

  const [loading, setLoading] = useState(!isNew);
  const [notFound, setNotFound] = useState(false);
  const [rule, setRule] = useState<AssignmentRule>(emptyRule());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isNew) return;
    (async () => {
      const r = await getById<AssignmentRule>('assignmentRules', id ?? '');
      if (!r) setNotFound(true);
      else setRule(r);
      setLoading(false);
    })();
  }, [id, isNew]);

  if (notFound) {
    return (
      <div className="empty-cell">
        Rule not found. <Link to="/setup/assignment-rules">Back to Assignment Rules</Link>
      </div>
    );
  }
  if (loading) return <Spinner label="Loading rule…" />;

  const fields: ModuleFieldDef[] = getConditionFields(rule.module);
  const fieldFor = (key: string) => fields.find((f) => f.key === key);

  const updateCondition = (index: number, patch: Partial<AssignmentRule['conditions'][number]>) => {
    setRule({ ...rule, conditions: rule.conditions.map((c, i) => (i === index ? { ...c, ...patch } : c)) });
  };

  const addCondition = () => {
    const first = fields[0];
    setRule({ ...rule, conditions: [...rule.conditions, { field: first?.key ?? '', operator: 'equals', value: '' }] });
  };

  const removeCondition = (index: number) => {
    setRule({ ...rule, conditions: rule.conditions.filter((_, i) => i !== index) });
  };

  const save = async () => {
    if (!rule.name.trim() || !rule.assignTo) {
      toast.push('error', 'Name and an assign-to user are required.');
      return;
    }
    setBusy(true);
    await upsert('assignmentRules', { ...rule, name: rule.name.trim() });
    setBusy(false);
    toast.push('success', `Rule "${rule.name}" saved.`);
    navigate(isNew ? '/setup/assignment-rules' : `/setup/assignment-rules/${rule.id}`);
  };

  return (
    <div data-testid="assignment-rule-form-page">
      <nav className="breadcrumbs">
        <Link to="/setup">Setup</Link> <span>/</span> <Link to="/setup/assignment-rules">Assignment Rules</Link>{' '}
        <span>/</span> <span>{isNew ? 'New rule' : rule.name}</span>
      </nav>
      <div className="page-header">
        <h1>{isNew ? 'New assignment rule' : `Edit rule — ${rule.name}`}</h1>
        <div className="page-actions">
          <button className="btn" onClick={() => navigate(isNew ? '/setup/assignment-rules' : `/setup/assignment-rules/${rule.id}`)}>
            Cancel
          </button>
          <button className="btn btn-primary" data-testid="assignment-rule-save-btn" disabled={busy} onClick={save}>
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
              data-testid="assignment-rule-name"
              value={rule.name}
              onChange={(e) => setRule({ ...rule, name: e.target.value })}
            />
          </div>
          <div className="field">
            <span className="field-label">Module</span>
            <Select
              value={rule.module}
              options={MODULE_OPTIONS}
              onChange={(v) => {
                const nextFields = getConditionFields(v as AssignmentRuleModule);
                setRule({
                  ...rule,
                  module: v as AssignmentRuleModule,
                  conditions: [{ field: nextFields[0]?.key ?? '', operator: 'equals', value: '' }],
                });
              }}
              testId="assignment-rule-module"
            />
          </div>
          <div className="field">
            <span className="field-label">Assign to *</span>
            <Select
              value={rule.assignTo}
              options={users.map((u) => ({ value: u.id, label: u.name }))}
              onChange={(v) => setRule({ ...rule, assignTo: v })}
              placeholder="Choose user…"
              testId="assignment-rule-assignto"
            />
          </div>
          <div className="field">
            <span className="field-label">Priority (lower runs first)</span>
            <input
              className="input"
              type="number"
              min={1}
              value={rule.priority}
              onChange={(e) => setRule({ ...rule, priority: Number(e.target.value) })}
            />
          </div>
        </div>
        <label className="checkbox-label">
          <input type="checkbox" checked={rule.active} onChange={(e) => setRule({ ...rule, active: e.target.checked })} />
          Active
        </label>
      </div>

      <div className="card">
        <h3>Conditions</h3>
        <p className="muted">A record must match every condition below for this rule to apply, on create or edit.</p>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Field</th>
                <th>Operator</th>
                <th>Value</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rule.conditions.map((condition, index) => {
                const field = fieldFor(condition.field);
                return (
                  <tr key={index}>
                    <td style={{ minWidth: 180 }}>
                      <Select
                        value={condition.field}
                        options={fields.map((f) => ({ value: f.key, label: f.label + (f.isCustom ? ' (custom)' : '') }))}
                        onChange={(v) => updateCondition(index, { field: v, value: '' })}
                        testId={`assignment-rule-condition-field-${index}`}
                      />
                    </td>
                    <td style={{ minWidth: 140 }}>
                      <Select
                        value={condition.operator}
                        options={OPERATOR_OPTIONS}
                        onChange={(v) => updateCondition(index, { operator: v as RuleOperator })}
                      />
                    </td>
                    <td style={{ minWidth: 180 }}>
                      {field?.kind === 'select' ? (
                        <Select
                          value={condition.value}
                          options={(field.options ?? []).map((o) => ({ value: o, label: o }))}
                          onChange={(v) => updateCondition(index, { value: v })}
                          placeholder="Choose value…"
                          testId={`assignment-rule-condition-value-${index}`}
                        />
                      ) : field?.kind === 'boolean' ? (
                        <Select
                          value={condition.value}
                          options={[{ value: 'true', label: 'True' }, { value: 'false', label: 'False' }]}
                          onChange={(v) => updateCondition(index, { value: v })}
                        />
                      ) : (
                        <input
                          className="input"
                          type={field?.kind === 'number' ? 'number' : 'text'}
                          value={condition.value}
                          onChange={(e) => updateCondition(index, { value: e.target.value })}
                          data-testid={`assignment-rule-condition-value-${index}`}
                        />
                      )}
                    </td>
                    <td>
                      <button className="link-btn" onClick={() => removeCondition(index)}>
                        Remove
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <button className="btn btn-small" onClick={addCondition}>
          + Add condition
        </button>
      </div>
    </div>
  );
}
