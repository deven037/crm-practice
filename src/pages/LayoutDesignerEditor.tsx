import { DragEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Trash2, X } from 'lucide-react';
import { getById, newId, removeMany, upsert } from '../data/store';
import { CustomFieldModule, LayoutTab, PageLayout } from '../types';
import { Modal } from '../components/Modal';
import { Spinner } from '../components/Spinner';
import { useToast } from '../components/Toast';
import { useAuth } from '../auth/AuthContext';
import { getAllModuleFields, ModuleFieldDef } from '../utils/moduleFields';
import { classNames } from '../utils';

function blankLayout(mod: CustomFieldModule): PageLayout {
  return {
    id: newId('pagelayout'),
    module: mod,
    name: 'New Layout',
    isDefault: false,
    tabs: [{ id: newId('layouttab'), label: 'Tab 1', fieldKeys: [] }],
  };
}

export function LayoutDesignerEditor() {
  const { module, id } = useParams<{ module: string; id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const readOnly = user?.role !== 'admin';
  const mod = (module ?? '') as CustomFieldModule;
  const isNew = !id || id === 'new';

  const [loading, setLoading] = useState(!isNew);
  const [notFound, setNotFound] = useState(false);
  const [layout, setLayout] = useState<PageLayout | null>(isNew ? blankLayout(mod) : null);
  const [activeTabId, setActiveTabId] = useState(isNew ? layout!.tabs[0].id : '');
  const [newTabLabel, setNewTabLabel] = useState('');
  const [draggingKey, setDraggingKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (isNew) return;
    (async () => {
      const l = await getById<PageLayout>('pageLayouts', id ?? '');
      if (!l) {
        setNotFound(true);
      } else {
        setLayout(l);
        setActiveTabId(l.tabs[0]?.id ?? '');
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (notFound) {
    return (
      <div className="empty-cell">
        Layout not found. <Link to={`/setup/layouts/${mod}`}>Back to layouts</Link>
      </div>
    );
  }
  if (loading || !layout) return <Spinner label="Loading layout…" />;

  const allFields: ModuleFieldDef[] = getAllModuleFields(mod);
  const placedKeys = new Set(layout.tabs.flatMap((t) => t.fieldKeys));
  const activeTab = layout.tabs.find((t) => t.id === activeTabId) ?? layout.tabs[0];
  const availableFields = allFields.filter((f) => !placedKeys.has(f.key));
  const includedFields = (activeTab?.fieldKeys ?? [])
    .map((key) => allFields.find((f) => f.key === key))
    .filter((f): f is ModuleFieldDef => Boolean(f));

  const updateActiveTab = (patch: Partial<LayoutTab>) => {
    setLayout({ ...layout, tabs: layout.tabs.map((t) => (t.id === activeTab?.id ? { ...t, ...patch } : t)) });
  };

  const addTab = () => {
    if (!newTabLabel.trim()) return;
    const tab: LayoutTab = { id: newId('layouttab'), label: newTabLabel.trim(), fieldKeys: [] };
    setLayout({ ...layout, tabs: [...layout.tabs, tab] });
    setActiveTabId(tab.id);
    setNewTabLabel('');
  };

  const removeTab = (tabId: string) => {
    if (layout.tabs.length <= 1) return;
    const next = layout.tabs.filter((t) => t.id !== tabId);
    setLayout({ ...layout, tabs: next });
    if (activeTabId === tabId) setActiveTabId(next[0].id);
  };

  // Reads dataTransfer first (set synchronously on dragstart, so it's always current by
  // drop time) and falls back to React state — state alone can lag a tick behind on fast
  // drag sequences since setDraggingKey's update isn't guaranteed to have flushed yet.
  const dropOnIncluded = (e: DragEvent, targetIndex: number) => {
    const key = e.dataTransfer.getData('text/field-key') || draggingKey;
    if (!key || !activeTab) return;
    const next = activeTab.fieldKeys.filter((k) => k !== key);
    next.splice(targetIndex, 0, key);
    updateActiveTab({ fieldKeys: next });
    setDraggingKey(null);
  };

  const dropOnAvailable = (e: DragEvent) => {
    const key = e.dataTransfer.getData('text/field-key') || draggingKey;
    if (!key || !activeTab) return;
    updateActiveTab({ fieldKeys: activeTab.fieldKeys.filter((k) => k !== key) });
    setDraggingKey(null);
  };

  // Nothing is persisted until this fires — creating via "+ New Layout" only builds the
  // draft in local state (see blankLayout above); Cancel/navigating away discards it.
  const save = async () => {
    if (!layout.isDefault && !layout.name.trim()) {
      toast.push('error', 'Name is required.');
      return;
    }
    setBusy(true);
    await upsert('pageLayouts', layout);
    setBusy(false);
    toast.push('success', `Layout "${layout.name}" saved.`);
    navigate(`/setup/layouts/${mod}`);
  };

  const doDelete = async () => {
    await removeMany('pageLayouts', [layout.id]);
    toast.push('success', `Layout "${layout.name}" deleted.`);
    navigate(`/setup/layouts/${mod}`);
  };

  return (
    <div data-testid="layout-designer-editor-page">
      <nav className="breadcrumbs">
        <Link to="/setup">Setup</Link> <span>/</span> <Link to={`/setup/layouts/${mod}`}>Page Layouts</Link>{' '}
        <span>/</span> <span>{layout.name}</span>
      </nav>
      <div className="page-header">
        <h1>{isNew ? 'New layout' : layout.isDefault ? `${layout.name} (Default)` : `Edit layout — ${layout.name}`}</h1>
        <div className="page-actions">
          {!isNew && !layout.isDefault && !readOnly && (
            <button className="btn btn-danger" onClick={() => setDeleting(true)}>
              <Trash2 size={14} /> Delete
            </button>
          )}
          <button className="btn" onClick={() => navigate(`/setup/layouts/${mod}`)}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={readOnly || busy} data-testid="save-page-layout-btn" onClick={save}>
            {busy ? 'Saving…' : 'Save layout'}
          </button>
        </div>
      </div>

      {layout.isDefault && (
        <div className="banner banner-info" data-testid="default-layout-banner">
          This is the built-in default layout — its name is locked, but you can still rearrange its tabs and fields.
        </div>
      )}

      <div className="card form-card">
        <div className="field">
          <span className="field-label">Layout name *</span>
          <input
            className="input"
            data-testid="page-layout-name"
            disabled={layout.isDefault}
            value={layout.name}
            onChange={(e) => setLayout({ ...layout, name: e.target.value })}
          />
        </div>
      </div>

      <div className="card">
        <h3>Tabs</h3>
        <div className="chip-filters" data-testid="page-layout-tabs">
          {layout.tabs.map((tab) => (
            <span key={tab.id} className={classNames('chip-filter', tab.id === activeTabId && 'active')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ cursor: 'pointer' }} onClick={() => setActiveTabId(tab.id)}>
                {tab.label}
              </span>
              {layout.tabs.length > 1 && (
                <X size={12} style={{ cursor: 'pointer' }} onClick={() => removeTab(tab.id)} aria-label={`Remove tab ${tab.label}`} />
              )}
            </span>
          ))}
        </div>
        <div className="ticket-meta" style={{ marginTop: 8, marginBottom: 0 }}>
          <input
            className="input"
            style={{ maxWidth: 220 }}
            placeholder="New tab name…"
            data-testid="new-tab-name"
            value={newTabLabel}
            onChange={(e) => setNewTabLabel(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addTab()}
          />
          <button className="btn btn-small" data-testid="add-tab-btn" onClick={addTab}>
            + Add tab
          </button>
        </div>
      </div>

      <div className="card">
        <h4>Fields in “{activeTab?.label}”</h4>
        <div className="dnd-columns">
          <div className="card">
            <h4>Available fields</h4>
            <ul className="dnd-list" data-testid="layout-designer-available" onDragOver={(e) => e.preventDefault()} onDrop={dropOnAvailable}>
              {availableFields.map((f) => (
                <li
                  key={f.key}
                  className="dnd-item"
                  draggable={!readOnly}
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/field-key', f.key);
                    setDraggingKey(f.key);
                  }}
                >
                  ⠿ {f.label} <span className="muted">({f.isCustom ? 'custom' : 'system'})</span>
                </li>
              ))}
              {availableFields.length === 0 && <li className="muted">Every field is already placed in a tab.</li>}
            </ul>
          </div>
          <div className="card">
            <h4>Included in this tab</h4>
            <ul
              className="dnd-list"
              data-testid="layout-designer-included"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => dropOnIncluded(e, includedFields.length)}
            >
              {includedFields.map((f, index) => (
                <li
                  key={f.key}
                  className="dnd-item"
                  draggable={!readOnly}
                  onDragStart={(e) => {
                    e.stopPropagation();
                    e.dataTransfer.setData('text/field-key', f.key);
                    setDraggingKey(f.key);
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.stopPropagation();
                    dropOnIncluded(e, index);
                  }}
                >
                  ⠿ {f.label} <span className="muted">({f.isCustom ? 'custom' : 'system'})</span>
                </li>
              ))}
              {includedFields.length === 0 && <li className="muted">Drag fields here to include them in this tab.</li>}
            </ul>
          </div>
        </div>
      </div>

      {deleting && (
        <Modal
          title={`Delete layout — ${layout.name}`}
          onClose={() => setDeleting(false)}
          footer={
            <>
              <button className="btn" onClick={() => setDeleting(false)}>
                Cancel
              </button>
              <button className="btn btn-danger" data-testid="confirm-delete-btn" onClick={doDelete}>
                Delete layout
              </button>
            </>
          }
        >
          <p>Delete “{layout.name}”? This cannot be undone.</p>
        </Modal>
      )}
    </div>
  );
}
