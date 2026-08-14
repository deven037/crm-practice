import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAll, newId, removeMany, upsert } from '../data/store';
import { StatusCodeModule, StatusCodeSet } from '../types';
import { TemplateGallery } from '../components/TemplateGallery';
import { Modal } from '../components/Modal';
import { Select } from '../components/Select';
import { SkeletonRows } from '../components/Spinner';
import { useToast } from '../components/Toast';
import { useAuth } from '../auth/AuthContext';

const MODULE_FIELD_OPTIONS: { value: string; label: string; module: StatusCodeModule; field: string }[] = [
  { value: 'leads.status', label: 'Leads — Status', module: 'leads', field: 'status' },
  { value: 'deals.stage', label: 'Deals — Stage', module: 'deals', field: 'stage' },
  { value: 'campaigns.status', label: 'Campaigns — Status', module: 'campaigns', field: 'status' },
  { value: 'campaigns.channel', label: 'Campaigns — Channel', module: 'campaigns', field: 'channel' },
];

function emptySet(): StatusCodeSet {
  return { id: newId('statuscodes'), module: 'leads', field: 'status', name: '', options: [''], isSystem: false };
}

export function StatusCodes() {
  const toast = useToast();
  const { user } = useAuth();
  const readOnly = user?.role !== 'admin';

  const [loading, setLoading] = useState(true);
  const [sets, setSets] = useState<StatusCodeSet[]>([]);
  const [editing, setEditing] = useState<StatusCodeSet | null>(null);
  const [optionsText, setOptionsText] = useState('');

  const load = async () => {
    setSets(await getAll<StatusCodeSet>('statusCodeSets'));
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const startEdit = (set: StatusCodeSet) => {
    setEditing({ ...set });
    setOptionsText(set.options.join('\n'));
  };

  const save = async () => {
    if (!editing) return;
    const options = optionsText
      .split('\n')
      .map((o) => o.trim())
      .filter(Boolean);
    if (!editing.name.trim() || options.length === 0) {
      toast.push('error', 'Name and at least one option are required.');
      return;
    }
    await upsert('statusCodeSets', { ...editing, name: editing.name.trim(), options });
    toast.push('success', `Status code set "${editing.name}" saved.`);
    setEditing(null);
    load();
  };

  const remove = async (set: StatusCodeSet) => {
    if (!window.confirm(`Delete status code set "${set.name}"? Its <Select> will fall back to the built-in list.`)) return;
    await removeMany('statusCodeSets', [set.id]);
    toast.push('success', `Status code set "${set.name}" deleted.`);
    load();
  };

  return (
    <div data-testid="status-codes-page">
      <nav className="breadcrumbs">
        <Link to="/setup">Setup</Link> <span>/</span> <span>Status Codes</span>
      </nav>
      <div className="page-header">
        <h1>Status Codes</h1>
      </div>
      <p className="muted">
        Manage the picklist options shown when choosing a status. Scoped to fields without a protected workflow —
        never Ticket or Quote status, which follow fixed transition rules.
      </p>

      {loading ? (
        <SkeletonRows rows={4} />
      ) : (
        <TemplateGallery
          items={sets.map((s) => ({
            id: s.id,
            name: s.name,
            meta: `${s.options.length} option(s)${s.isSystem ? ' · Built-in' : ''}`,
            onClick: () => !readOnly && startEdit(s),
            rows: readOnly ? [] : [{ label: 'Delete', onClick: () => remove(s) }],
          }))}
          createLabel="New Set"
          createHint="Add a custom picklist for a status-like field."
          onCreate={() => {
            if (readOnly) return;
            setEditing(emptySet());
            setOptionsText('');
          }}
        />
      )}

      {editing && (
        <Modal
          title={sets.some((s) => s.id === editing.id) ? `Edit — ${editing.name}` : 'New status code set'}
          onClose={() => setEditing(null)}
          footer={
            <>
              <button className="btn" onClick={() => setEditing(null)}>
                Cancel
              </button>
              <button className="btn btn-primary" data-testid="status-codes-save-btn" onClick={save}>
                Save
              </button>
            </>
          }
        >
          <div className="field">
            <span className="field-label">Name *</span>
            <input
              className="input"
              data-testid="status-codes-name"
              value={editing.name}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
            />
          </div>
          <div className="field">
            <span className="field-label">Applies to</span>
            <Select
              value={`${editing.module}.${editing.field}`}
              options={MODULE_FIELD_OPTIONS}
              onChange={(v) => {
                const target = MODULE_FIELD_OPTIONS.find((o) => o.value === v);
                if (target) setEditing({ ...editing, module: target.module, field: target.field });
              }}
              disabled={editing.isSystem}
            />
          </div>
          <div className="field">
            <span className="field-label">Options (one per line) *</span>
            <textarea
              className="input"
              rows={6}
              data-testid="status-codes-options"
              value={optionsText}
              onChange={(e) => setOptionsText(e.target.value)}
            />
          </div>
        </Modal>
      )}
    </div>
  );
}
