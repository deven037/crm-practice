import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getAllSync, logAudit, newId, saveAll, setValue } from '../data/store';
import {
  CustomFieldDef,
  CustomFieldModule,
  CustomFieldType,
  CUSTOM_FIELD_MODULES,
  CUSTOM_FIELD_TYPES,
  LayoutDef,
  LayoutTarget,
} from '../types';
import { Modal } from '../components/Modal';
import { Select } from '../components/Select';
import { Tabs } from '../components/Tabs';
import { useToast } from '../components/Toast';
import { useAuth } from '../auth/AuthContext';
import { classNames, slugify } from '../utils';

const MODULE_LABELS: Record<CustomFieldModule, string> = {
  leads: 'Leads',
  contacts: 'Contacts',
  accounts: 'Accounts',
  deals: 'Deals',
  products: 'Products',
  tickets: 'Tickets',
  campaigns: 'Campaigns',
  quotes: 'Quotes',
};

interface GenericRecord {
  id: string;
  customFields?: Record<string, string | number | boolean | null>;
}

const emptyField = (module: CustomFieldModule): CustomFieldDef => ({
  id: newId('customfield'),
  module,
  key: '',
  label: '',
  type: 'text',
  required: false,
  createdAt: new Date().toISOString(),
});

export function ObjectConfig() {
  const { module } = useParams<{ module: string }>();
  const toast = useToast();
  const { user } = useAuth();
  const readOnly = user?.role !== 'admin';

  const isValidModule = (CUSTOM_FIELD_MODULES as readonly string[]).includes(module ?? '');
  const mod = (module ?? '') as CustomFieldModule;

  const [defs, setDefs] = useState<CustomFieldDef[]>(() =>
    isValidModule ? getAllSync<CustomFieldDef>('customFieldDefs').filter((d) => d.module === mod) : []
  );
  const [layouts, setLayouts] = useState<LayoutDef[]>(() =>
    isValidModule ? getAllSync<LayoutDef>('layouts').filter((l) => l.module === mod) : []
  );
  const [editingField, setEditingField] = useState<CustomFieldDef | null>(null);
  const [deletingField, setDeletingField] = useState<CustomFieldDef | null>(null);
  const [confirmLabel, setConfirmLabel] = useState('');
  const [target, setTarget] = useState<LayoutTarget>('form');
  const [stagedIds, setStagedIds] = useState<string[]>([]);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  useEffect(() => {
    setStagedIds(layouts.find((l) => l.target === target)?.fieldIds ?? []);
  }, [target, layouts]);

  if (!isValidModule) {
    return (
      <div className="empty-cell">
        Unknown module. <Link to="/admin">Back to Admin</Link>
      </div>
    );
  }

  const persistDefs = (next: CustomFieldDef[]) => {
    const others = getAllSync<CustomFieldDef>('customFieldDefs').filter((d) => d.module !== mod);
    setValue('customFieldDefs', [...others, ...next]);
    setDefs(next);
  };

  const persistLayouts = (next: LayoutDef[]) => {
    const others = getAllSync<LayoutDef>('layouts').filter((l) => l.module !== mod);
    setValue('layouts', [...others, ...next]);
    setLayouts(next);
  };

  const dependentCount = (key: string) =>
    getAllSync<GenericRecord>(mod).filter((r) => r.customFields?.[key] !== undefined && r.customFields?.[key] !== null)
      .length;

  const saveField = () => {
    if (!editingField) return;
    if (!editingField.label.trim()) {
      toast.push('error', 'Label is required.');
      return;
    }
    const isNew = !defs.some((d) => d.id === editingField.id);
    const field: CustomFieldDef = {
      ...editingField,
      label: editingField.label.trim(),
      key: isNew ? slugify(editingField.label) : editingField.key,
    };
    const next = isNew ? [...defs, field] : defs.map((d) => (d.id === field.id ? field : d));
    persistDefs(next);
    logAudit(
      user?.name ?? 'Unknown',
      'customfield.create',
      `${isNew ? 'Created' : 'Updated'} custom field "${field.label}" on ${MODULE_LABELS[mod]}`
    );
    toast.push('success', `Custom field "${field.label}" saved.`);
    setEditingField(null);
  };

  const deleteField = () => {
    if (!deletingField) return;
    const count = dependentCount(deletingField.key);
    if (count > 0) {
      const records = getAllSync<GenericRecord>(mod).map((r) => {
        if (r.customFields && deletingField.key in r.customFields) {
          const rest = { ...r.customFields };
          delete rest[deletingField.key];
          return { ...r, customFields: rest };
        }
        return r;
      });
      saveAll(mod, records);
    }
    persistDefs(defs.filter((d) => d.id !== deletingField.id));
    persistLayouts(layouts.map((l) => ({ ...l, fieldIds: l.fieldIds.filter((id) => id !== deletingField.id) })));
    logAudit(
      user?.name ?? 'Unknown',
      'customfield.delete',
      `Deleted custom field "${deletingField.label}" from ${MODULE_LABELS[mod]} (${count} record(s) had a value)`
    );
    toast.push('success', `Custom field "${deletingField.label}" deleted.`);
    setDeletingField(null);
  };

  const includedFields = stagedIds.map((id) => defs.find((d) => d.id === id)).filter((d): d is CustomFieldDef => Boolean(d));
  const availableFields = defs.filter((d) => !stagedIds.includes(d.id));

  const saveLayout = () => {
    const existing = layouts.find((l) => l.target === target);
    const next: LayoutDef = existing
      ? { ...existing, fieldIds: stagedIds }
      : { id: newId('layout'), module: mod, target, fieldIds: stagedIds };
    persistLayouts([...layouts.filter((l) => l.target !== target), next]);
    logAudit(user?.name ?? 'Unknown', 'layout.save', `Layout saved for ${MODULE_LABELS[mod]} (${target === 'form' ? 'Form' : 'Detail'})`);
    toast.push('success', 'Layout saved.');
  };

  const dropOnIncluded = (targetIndex: number) => {
    if (!draggingId) return;
    const next = stagedIds.filter((id) => id !== draggingId);
    next.splice(targetIndex, 0, draggingId);
    setStagedIds(next);
    setDraggingId(null);
  };

  const dropOnAvailable = () => {
    if (!draggingId) return;
    setStagedIds(stagedIds.filter((id) => id !== draggingId));
    setDraggingId(null);
  };

  return (
    <div data-testid="object-config-page">
      <nav className="breadcrumbs">
        <Link to="/admin">Admin</Link> <span>/</span> <Link to="/admin">Object Configuration</Link> <span>/</span>{' '}
        <span>{MODULE_LABELS[mod]}</span>
      </nav>

      <div className="page-header">
        <h1>{MODULE_LABELS[mod]} — Object Configuration</h1>
      </div>

      {readOnly && (
        <div className="banner banner-info" data-testid="object-config-readonly-banner">
          You have read-only access to this area. Contact an administrator to make changes.
        </div>
      )}

      <Tabs
        testId="object-config-tabs"
        tabs={[
          {
            id: 'fields',
            label: `Custom Fields (${defs.length})`,
            content: (
              <>
                <div className="toolbar">
                  <button
                    className="btn btn-primary"
                    disabled={readOnly}
                    onClick={() => setEditingField(emptyField(mod))}
                  >
                    + Add field
                  </button>
                </div>
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Label</th>
                        <th>Type</th>
                        <th>Options</th>
                        <th>Required</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {defs.map((f) => (
                        <tr key={f.id}>
                          <td>{f.label}</td>
                          <td>
                            <code>{f.type}</code>
                          </td>
                          <td>{f.options?.join(', ') ?? '—'}</td>
                          <td>{f.required ? 'Yes' : 'No'}</td>
                          <td>
                            <button className="link-btn" disabled={readOnly} onClick={() => setEditingField({ ...f })}>
                              Edit
                            </button>{' '}
                            <button
                              className="link-btn"
                              disabled={readOnly}
                              onClick={() => {
                                setConfirmLabel('');
                                setDeletingField(f);
                              }}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                      {defs.length === 0 && (
                        <tr>
                          <td colSpan={5} className="empty-cell">
                            No custom fields defined for {MODULE_LABELS[mod]} yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            ),
          },
          {
            id: 'layout',
            label: 'Layout',
            content: (
              <>
                <div className="chip-filters">
                  <button
                    className={classNames('chip-filter', target === 'form' && 'active')}
                    onClick={() => setTarget('form')}
                  >
                    Form (New + Edit)
                  </button>
                  <button
                    className={classNames('chip-filter', target === 'detail' && 'active')}
                    onClick={() => setTarget('detail')}
                  >
                    Detail
                  </button>
                </div>

                {defs.length === 0 ? (
                  <p className="muted">Define at least one custom field before designing a layout.</p>
                ) : (
                  <>
                    <div className="dnd-columns">
                      <div className="card">
                        <h4>Available fields</h4>
                        <ul
                          className="dnd-list"
                          data-testid="layout-available"
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={dropOnAvailable}
                        >
                          {availableFields.map((f) => (
                            <li
                              key={f.id}
                              className="dnd-item"
                              draggable={!readOnly}
                              onDragStart={() => setDraggingId(f.id)}
                            >
                              ⠿ {f.label} <span className="muted">({f.type})</span>
                            </li>
                          ))}
                          {availableFields.length === 0 && <li className="muted">All fields are in this layout.</li>}
                        </ul>
                      </div>
                      <div className="card">
                        <h4>Included in {target === 'form' ? 'Form' : 'Detail'} layout</h4>
                        <ul
                          className="dnd-list"
                          data-testid="layout-included"
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={() => dropOnIncluded(includedFields.length)}
                        >
                          {includedFields.map((f, index) => (
                            <li
                              key={f.id}
                              className="dnd-item"
                              draggable={!readOnly}
                              onDragStart={(e) => {
                                e.stopPropagation();
                                setDraggingId(f.id);
                              }}
                              onDragOver={(e) => e.preventDefault()}
                              onDrop={(e) => {
                                e.stopPropagation();
                                dropOnIncluded(index);
                              }}
                            >
                              ⠿ {f.label} <span className="muted">({f.type})</span>
                            </li>
                          ))}
                          {includedFields.length === 0 && <li className="muted">Drag fields here to include them.</li>}
                        </ul>
                      </div>
                    </div>
                    <div className="form-actions">
                      <button className="btn btn-primary" disabled={readOnly} data-testid="save-layout-btn" onClick={saveLayout}>
                        Save layout
                      </button>
                    </div>
                  </>
                )}
              </>
            ),
          },
        ]}
      />

      {editingField && (
        <Modal
          title={defs.some((d) => d.id === editingField.id) ? `Edit field — ${editingField.label}` : 'Add custom field'}
          onClose={() => setEditingField(null)}
          footer={
            <>
              <button className="btn" onClick={() => setEditingField(null)}>
                Cancel
              </button>
              <button className="btn btn-primary" data-testid="field-save-btn" onClick={saveField}>
                Save field
              </button>
            </>
          }
        >
          <div className="field">
            <span className="field-label">Label *</span>
            <input
              className="input"
              data-testid="field-label"
              value={editingField.label}
              onChange={(e) => setEditingField({ ...editingField, label: e.target.value })}
            />
          </div>
          <div className="field">
            <span className="field-label">Type</span>
            <Select
              value={editingField.type}
              options={CUSTOM_FIELD_TYPES.map((t) => ({ value: t, label: t }))}
              onChange={(v) => setEditingField({ ...editingField, type: v as CustomFieldType })}
              testId="field-type"
            />
          </div>
          {editingField.type === 'dropdown' && (
            <div className="field">
              <span className="field-label">Options (one per line)</span>
              <textarea
                className="input"
                rows={4}
                data-testid="field-options"
                value={(editingField.options ?? []).join('\n')}
                onChange={(e) =>
                  setEditingField({
                    ...editingField,
                    options: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean),
                  })
                }
              />
            </div>
          )}
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={editingField.required}
              onChange={(e) => setEditingField({ ...editingField, required: e.target.checked })}
            />
            Required
          </label>
        </Modal>
      )}

      {deletingField && (
        <Modal
          title={`Delete custom field — ${deletingField.label}`}
          onClose={() => setDeletingField(null)}
          footer={
            <>
              <button className="btn" onClick={() => setDeletingField(null)}>
                Cancel
              </button>
              <button
                className="btn btn-danger"
                data-testid="confirm-delete-field-btn"
                disabled={dependentCount(deletingField.key) > 0 && confirmLabel !== deletingField.label}
                onClick={deleteField}
              >
                Delete field
              </button>
            </>
          }
        >
          {dependentCount(deletingField.key) === 0 ? (
            <p>Delete “{deletingField.label}”? This cannot be undone.</p>
          ) : (
            <>
              <div className="banner banner-error" role="alert">
                {dependentCount(deletingField.key)} record(s) have a value in this field. Deleting it will remove that
                data permanently.
              </div>
              <div className="field">
                <span className="field-label">Type the field label to confirm</span>
                <input
                  className="input"
                  data-testid="delete-confirm-input"
                  placeholder={deletingField.label}
                  value={confirmLabel}
                  onChange={(e) => setConfirmLabel(e.target.value)}
                />
              </div>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}
