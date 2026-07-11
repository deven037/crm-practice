import { useEffect, useMemo, useState } from 'react';
import { getAll, getAllSync, logAudit, newId, removeMany, saveAll, upsert } from '../data/store';
import { Account, AuditEntry, Deal, Lead, Role, User } from '../types';
import { Modal } from '../components/Modal';
import { Select } from '../components/Select';
import { Tabs } from '../components/Tabs';
import { SkeletonRows } from '../components/Spinner';
import { useToast } from '../components/Toast';
import { useAuth } from '../auth/AuthContext';
import { formatDateTime } from '../utils';

const ROLES: { value: Role; label: string }[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'rep', label: 'Sales Rep' },
  { value: 'viewer', label: 'Viewer' },
];

export function Admin() {
  const toast = useToast();
  const { user } = useAuth();
  const readOnly = user?.role !== 'admin';

  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [auditUserFilter, setAuditUserFilter] = useState('');
  const [editing, setEditing] = useState<User | null>(null);
  const [reassigning, setReassigning] = useState<{ target: User; leads: number; accounts: number; deals: number } | null>(null);
  const [reassignTo, setReassignTo] = useState('');

  const load = async () => {
    const [u, a] = await Promise.all([getAll<User>('users'), getAll<AuditEntry>('audit')]);
    setUsers(u);
    setAudit(a);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const toggleActive = async (target: User) => {
    const next = { ...target, active: !target.active };
    await upsert('users', next);
    logAudit(user?.name ?? 'Unknown', 'user.toggle', `${next.active ? 'Activated' : 'Deactivated'} ${target.name}`);
    toast.push('success', `${target.name} ${next.active ? 'activated' : 'deactivated'}.`);
    load();
  };

  const deleteUser = async (target: User) => {
    if (target.id === user?.id) {
      toast.push('error', 'You cannot delete your own account.');
      return;
    }
    // Referential check: a user who owns records must hand them over first.
    const ownedLeads = getAllSync<Lead>('leads').filter((l) => l.ownerId === target.id).length;
    const ownedAccounts = getAllSync<Account>('accounts').filter((a) => a.ownerId === target.id).length;
    const ownedDeals = getAllSync<Deal>('deals').filter((d) => d.ownerId === target.id).length;
    if (ownedLeads + ownedAccounts + ownedDeals > 0) {
      setReassignTo('');
      setReassigning({ target, leads: ownedLeads, accounts: ownedAccounts, deals: ownedDeals });
      return;
    }
    if (!window.confirm(`Delete user "${target.name}"?`)) return;
    await removeMany('users', [target.id]);
    logAudit(user?.name ?? 'Unknown', 'user.delete', `Deleted user ${target.name}`);
    toast.push('success', `User "${target.name}" deleted.`);
    load();
  };

  const reassignAndDelete = async () => {
    if (!reassigning || !reassignTo) return;
    const { target } = reassigning;
    const remap = <T extends { ownerId: string }>(items: T[]) =>
      items.map((item) => (item.ownerId === target.id ? { ...item, ownerId: reassignTo } : item));
    await saveAll('leads', remap(getAllSync<Lead>('leads')));
    await saveAll('accounts', remap(getAllSync<Account>('accounts')));
    await saveAll('deals', remap(getAllSync<Deal>('deals')));
    await removeMany('users', [target.id]);
    const newOwner = users.find((u) => u.id === reassignTo)?.name ?? 'unknown';
    logAudit(user?.name ?? 'Unknown', 'user.delete', `Deleted ${target.name}; records reassigned to ${newOwner}`);
    toast.push('success', `User "${target.name}" deleted — records reassigned to ${newOwner}.`);
    setReassigning(null);
    load();
  };

  const saveUser = async (target: User) => {
    if (!target.name.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(target.email)) {
      toast.push('error', 'Name and a valid email are required.');
      return;
    }
    await upsert('users', target);
    logAudit(user?.name ?? 'Unknown', 'user.save', `Saved user ${target.name}`);
    toast.push('success', `User "${target.name}" saved.`);
    setEditing(null);
    load();
  };

  const filteredAudit = useMemo(
    () => (auditUserFilter ? audit.filter((a) => a.user === auditUserFilter) : audit),
    [audit, auditUserFilter]
  );

  const auditUsers = useMemo(() => [...new Set(audit.map((a) => a.user))], [audit]);

  return (
    <div data-testid="admin-page">
      <div className="page-header">
        <h1>Admin</h1>
      </div>

      {readOnly && (
        <div className="banner banner-info" data-testid="admin-readonly-banner">
          You have read-only access to this area. Contact an administrator to make changes.
        </div>
      )}

      {loading ? (
        <SkeletonRows rows={6} />
      ) : (
        <Tabs
          testId="admin-tabs"
          tabs={[
            {
              id: 'users',
              label: `Users (${users.length})`,
              content: (
                <>
                  <div className="toolbar">
                    <button
                      className="btn btn-primary"
                      disabled={readOnly}
                      onClick={() =>
                        setEditing({ id: newId('user'), name: '', email: '', password: 'Pass@123', role: 'rep', active: true })
                      }
                    >
                      + Add user
                    </button>
                  </div>
                  <div className="table-wrap">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Email</th>
                          <th>Role</th>
                          <th>Active</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map((u) => (
                          <tr key={u.id}>
                            <td>{u.name}</td>
                            <td>{u.email}</td>
                            <td>
                              <span className={`pill role-${u.role}`}>{ROLES.find((r) => r.value === u.role)?.label}</span>
                            </td>
                            <td>
                              {/* Toggle switch */}
                              <label className="switch">
                                <input
                                  type="checkbox"
                                  checked={u.active}
                                  disabled={readOnly}
                                  aria-label={`${u.name} active`}
                                  onChange={() => toggleActive(u)}
                                />
                                <span className="switch-slider" />
                              </label>
                            </td>
                            <td>
                              <button className="link-btn" disabled={readOnly} onClick={() => setEditing({ ...u })}>
                                Edit
                              </button>{' '}
                              <button className="link-btn" disabled={readOnly} onClick={() => deleteUser(u)}>
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ),
            },
            {
              id: 'audit',
              label: `Audit log (${audit.length})`,
              content: (
                <>
                  <div className="toolbar">
                    <Select
                      value={auditUserFilter}
                      options={[{ value: '', label: 'All users' }, ...auditUsers.map((u) => ({ value: u, label: u }))]}
                      onChange={setAuditUserFilter}
                      testId="audit-user-filter"
                    />
                  </div>
                  <div className="table-wrap">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>When</th>
                          <th>User</th>
                          <th>Action</th>
                          <th>Detail</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredAudit.slice(0, 50).map((entry) => (
                          <tr key={entry.id}>
                            <td>{formatDateTime(entry.when)}</td>
                            <td>{entry.user}</td>
                            <td>
                              <code>{entry.action}</code>
                            </td>
                            <td>{entry.detail}</td>
                          </tr>
                        ))}
                        {filteredAudit.length === 0 && (
                          <tr>
                            <td colSpan={4} className="empty-cell">
                              No audit entries.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              ),
            },
          ]}
        />
      )}

      {reassigning && (
        <Modal
          title={`Delete user — ${reassigning.target.name}`}
          onClose={() => setReassigning(null)}
          footer={
            <>
              <button className="btn" onClick={() => setReassigning(null)}>
                Cancel
              </button>
              <button
                className="btn btn-danger"
                data-testid="reassign-delete-btn"
                disabled={!reassignTo}
                onClick={reassignAndDelete}
              >
                Reassign & delete
              </button>
            </>
          }
        >
          <div className="banner banner-info" data-testid="reassign-banner">
            {reassigning.target.name} owns <strong>{reassigning.leads} lead(s)</strong>,{' '}
            <strong>{reassigning.accounts} account(s)</strong> and <strong>{reassigning.deals} deal(s)</strong>. These
            must be reassigned before the user can be deleted.
          </div>
          <div className="field">
            <span className="field-label">Reassign all records to *</span>
            <Select
              value={reassignTo}
              options={users
                .filter((u) => u.id !== reassigning.target.id && u.active)
                .map((u) => ({ value: u.id, label: u.name }))}
              onChange={setReassignTo}
              placeholder="Choose new owner…"
              testId="reassign-select"
            />
          </div>
        </Modal>
      )}

      {editing && (
        <Modal
          title={users.some((u) => u.id === editing.id) ? `Edit user — ${editing.name}` : 'Add user'}
          onClose={() => setEditing(null)}
          footer={
            <>
              <button className="btn" onClick={() => setEditing(null)}>
                Cancel
              </button>
              <button className="btn btn-primary" data-testid="user-save-btn" onClick={() => saveUser(editing)}>
                Save user
              </button>
            </>
          }
        >
          <div className="field">
            <span className="field-label">Full name *</span>
            <input className="input" data-testid="user-name" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
          </div>
          <div className="field">
            <span className="field-label">Email *</span>
            <input className="input" data-testid="user-email" value={editing.email} onChange={(e) => setEditing({ ...editing, email: e.target.value })} />
          </div>
          <div className="field">
            <span className="field-label">Role</span>
            <Select
              value={editing.role}
              options={ROLES}
              onChange={(v) => setEditing({ ...editing, role: v as Role })}
              testId="user-role"
            />
          </div>
          <label className="checkbox-label">
            <input type="checkbox" checked={editing.active} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} />
            Active
          </label>
        </Modal>
      )}
    </div>
  );
}
