import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getById, newId, upsert } from '../data/store';
import { CustomFieldModule, CUSTOM_FIELD_MODULES, RoleDef, RoleOperation, ROLE_OPERATIONS, RolePermission } from '../types';
import { Spinner } from '../components/Spinner';
import { useToast } from '../components/Toast';

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

const OPERATION_LABELS: Record<RoleOperation, string> = {
  view: 'View',
  create: 'Create',
  edit: 'Edit',
  delete: 'Delete',
};

function emptyPermissions(): RolePermission[] {
  return CUSTOM_FIELD_MODULES.map((module) => ({ module, operations: [] }));
}

/** Fills in any module missing from a saved role's permissions array (e.g. a role saved before a new module existed). */
function normalizePermissions(perms: RolePermission[] | undefined): RolePermission[] {
  const byModule = new Map((perms ?? []).map((p) => [p.module, p]));
  return CUSTOM_FIELD_MODULES.map((module) => byModule.get(module) ?? { module, operations: [] });
}

export function RoleForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const isNew = id === 'new';

  const [loading, setLoading] = useState(!isNew);
  const [notFound, setNotFound] = useState(false);
  const [roleId, setRoleId] = useState('');
  const [isSystem, setIsSystem] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [permissions, setPermissions] = useState<RolePermission[]>(emptyPermissions());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isNew) {
      setRoleId(newId('role'));
      return;
    }
    (async () => {
      const role = await getById<RoleDef>('roleDefs', id ?? '');
      if (!role) {
        setNotFound(true);
      } else {
        setRoleId(role.id);
        setIsSystem(role.isSystem);
        setName(role.name);
        setDescription(role.description);
        setPermissions(normalizePermissions(role.permissions));
      }
      setLoading(false);
    })();
  }, [id, isNew]);

  if (notFound) {
    return (
      <div className="empty-cell">
        Role not found. <Link to="/setup/roles">Back to roles</Link>
      </div>
    );
  }
  if (loading) return <Spinner label="Loading role…" />;

  const toggleOperation = (module: CustomFieldModule, operation: RoleOperation) => {
    setPermissions((prev) =>
      prev.map((p) =>
        p.module !== module
          ? p
          : { ...p, operations: p.operations.includes(operation) ? p.operations.filter((o) => o !== operation) : [...p.operations, operation] }
      )
    );
  };

  const toggleAllForModule = (module: CustomFieldModule, checked: boolean) => {
    setPermissions((prev) => prev.map((p) => (p.module !== module ? p : { ...p, operations: checked ? [...ROLE_OPERATIONS] : [] })));
  };

  const save = async () => {
    if (!isSystem && !name.trim()) {
      toast.push('error', 'Name is required.');
      return;
    }
    const role: RoleDef = { id: roleId, name: name.trim(), description, isSystem, permissions };
    setBusy(true);
    await upsert('roleDefs', role);
    setBusy(false);
    toast.push('success', `Role "${role.name}" saved.`);
    navigate('/setup/roles');
  };

  return (
    <div data-testid="role-form-page">
      <nav className="breadcrumbs">
        <Link to="/setup">Setup</Link> <span>/</span> <Link to="/setup/roles">Roles</Link> <span>/</span>{' '}
        <span>{isNew ? 'New role' : name}</span>
      </nav>
      <div className="page-header">
        <h1>{isNew ? 'New role' : `Edit role — ${name}`}</h1>
        <div className="page-actions">
          <button className="btn" onClick={() => navigate('/setup/roles')}>
            Cancel
          </button>
          <button className="btn btn-primary" data-testid="role-save-btn" disabled={busy} onClick={save}>
            {busy ? 'Saving…' : 'Save role'}
          </button>
        </div>
      </div>

      {isSystem && (
        <div className="banner banner-info" data-testid="system-role-banner">
          System roles mirror the app's built-in permission tiers — the name and description can't be changed, but you
          can still fill in its operations checklist below for reference.
        </div>
      )}

      <div className="card form-card">
        <div className="form-grid">
          <div className="field">
            <span className="field-label">Name *</span>
            <input
              className="input"
              data-testid="role-name"
              disabled={isSystem}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="field field-span">
            <span className="field-label">Description</span>
            <textarea
              className="input"
              rows={2}
              data-testid="role-description"
              disabled={isSystem}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="card">
        <h3>Operations</h3>
        <p className="muted">
          Check which operations this role is meant to perform per module — reference only, doesn't change what the
          assigned users can actually do in the app.
        </p>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Module</th>
                {ROLE_OPERATIONS.map((op) => (
                  <th key={op} className="checkbox-cell">
                    {OPERATION_LABELS[op]}
                  </th>
                ))}
                <th className="checkbox-cell">All</th>
              </tr>
            </thead>
            <tbody>
              {permissions.map((perm) => (
                <tr key={perm.module}>
                  <td>{MODULE_LABELS[perm.module]}</td>
                  {ROLE_OPERATIONS.map((op) => (
                    <td key={op} className="checkbox-cell">
                      <input
                        type="checkbox"
                        data-testid={`role-perm-${perm.module}-${op}`}
                        aria-label={`${MODULE_LABELS[perm.module]} ${OPERATION_LABELS[op]}`}
                        checked={perm.operations.includes(op)}
                        onChange={() => toggleOperation(perm.module, op)}
                      />
                    </td>
                  ))}
                  <td className="checkbox-cell">
                    <input
                      type="checkbox"
                      aria-label={`${MODULE_LABELS[perm.module]} all operations`}
                      checked={perm.operations.length === ROLE_OPERATIONS.length}
                      onChange={(e) => toggleAllForModule(perm.module, e.target.checked)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
