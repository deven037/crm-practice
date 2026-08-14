import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getAll, removeMany } from '../data/store';
import { RoleDef, CUSTOM_FIELD_MODULES } from '../types';
import { SkeletonRows } from '../components/Spinner';
import { useToast } from '../components/Toast';
import { useAuth } from '../auth/AuthContext';

/**
 * Purely informational directory of role names/descriptions/permission-checklists —
 * separate from the 3-value `Role` permission union that actually gates access (see
 * src/types.ts). Creating or editing a row here never grants any permission; the 3
 * isSystem rows mirror today's real tiers for reference and cannot be renamed or deleted.
 */
export function Roles() {
  const toast = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  const readOnly = user?.role !== 'admin';

  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<RoleDef[]>([]);

  const load = async () => {
    setRoles(await getAll<RoleDef>('roleDefs'));
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const deleteRole = async (role: RoleDef) => {
    if (role.isSystem) return;
    if (!window.confirm(`Delete role "${role.name}"?`)) return;
    await removeMany('roleDefs', [role.id]);
    toast.push('success', `Role "${role.name}" deleted.`);
    load();
  };

  const permissionSummary = (role: RoleDef) => {
    const count = (role.permissions ?? []).filter((p) => p.operations.length > 0).length;
    if (count === 0) return 'No operations set';
    return `${count} of ${CUSTOM_FIELD_MODULES.length} module(s) configured`;
  };

  return (
    <div data-testid="roles-page">
      <nav className="breadcrumbs">
        <Link to="/setup">Setup</Link> <span>/</span> <span>Roles</span>
      </nav>
      <div className="page-header">
        <h1>Roles ({roles.length})</h1>
        <div className="page-actions">
          <button className="btn btn-create" disabled={readOnly} onClick={() => navigate('/setup/roles/new')}>
            + New Role
          </button>
        </div>
      </div>

      <p className="muted">
        Roles here are a reference directory only — they describe who's who and which operations they're meant to
        perform, but don't grant any permission. Access is still controlled by each user's Admin / Sales Rep / Viewer
        assignment on the Users page.
      </p>

      {readOnly && (
        <div className="banner banner-info" data-testid="roles-readonly-banner">
          You have read-only access to this area. Contact an administrator to make changes.
        </div>
      )}

      {loading ? (
        <SkeletonRows rows={4} />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Description</th>
                <th>Operations</th>
                <th>System</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {roles.map((role) => (
                <tr key={role.id}>
                  <td>{role.name}</td>
                  <td>{role.description || '—'}</td>
                  <td className="muted">{permissionSummary(role)}</td>
                  <td>{role.isSystem ? <span className="pill status-converted">System</span> : <span className="muted">Custom</span>}</td>
                  <td>
                    <button className="link-btn" disabled={readOnly} onClick={() => navigate(`/setup/roles/${role.id}`)}>
                      Edit
                    </button>{' '}
                    {!role.isSystem && (
                      <button className="link-btn" disabled={readOnly} onClick={() => deleteRole(role)}>
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {roles.length === 0 && (
                <tr>
                  <td colSpan={5} className="empty-cell">
                    No roles yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
