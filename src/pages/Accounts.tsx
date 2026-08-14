import { Fragment, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getAll } from '../data/store';
import { Account, User } from '../types';
import { SkeletonRows } from '../components/Spinner';
import { ExpandPanelRow, ExpandToggle } from '../components/ExpandableTableRow';
import { LayoutPickerPanel } from '../components/LayoutPickerPanel';
import { ToolBoxPanel } from '../components/ToolBoxPanel';
import { useAccountRelated } from '../hooks/useAccountRelated';
import { formatCurrency } from '../utils';

function AccountExpandPanel({ account }: { account: Account }) {
  const { contacts, deals, quotes, loading } = useAccountRelated(account.id);

  if (loading) return <span className="muted">Loading…</span>;

  return (
    <div className="expand-panel-grid">
      <div>
        <span className="key-info-label">Phone</span>
        <div>{account.phone || '—'}</div>
      </div>
      <div>
        <span className="key-info-label">Contacts</span>
        <div>{contacts.length}</div>
      </div>
      <div>
        <span className="key-info-label">Deals</span>
        <div>{deals.length}</div>
      </div>
      <div>
        <span className="key-info-label">Quotes</span>
        <div>{quotes.length}</div>
      </div>
      <div>
        <Link to={`/accounts/${account.id}`}>Open full page ↗</Link>
      </div>
    </div>
  );
}

export function Accounts() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [query, setQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [layoutPickerOpen, setLayoutPickerOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const [a, u] = await Promise.all([getAll<Account>('accounts'), getAll<User>('users')]);
      setAccounts(a);
      setUsers(u);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return accounts;
    return accounts.filter((a) => a.name.toLowerCase().includes(q) || a.industry.toLowerCase().includes(q));
  }, [accounts, query]);

  return (
    <div data-testid="accounts-page">
      <div className="page-header">
        <h1>Accounts</h1>
        <div className="page-actions">
          <button className="btn btn-create" onClick={() => setLayoutPickerOpen(true)}>
            + New Account
          </button>
        </div>
      </div>

      <ToolBoxPanel
        module="accounts"
        links={[
          { label: 'Import Data', to: '/setup/import' },
          { label: 'Custom Fields', to: '/admin/objects/accounts' },
          { label: 'Customise Page Layout', to: '/setup/layouts/accounts' },
        ]}
      />

      <div className="toolbar">
        <input
          type="search"
          className="input search-input"
          placeholder="Search accounts…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {loading ? (
        <SkeletonRows rows={8} />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 32 }}></th>
                <th>Name</th>
                <th>Industry</th>
                <th className="num">Employees</th>
                <th className="num">Annual revenue</th>
                <th>Owner</th>
                <th>Website</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((account) => (
                <Fragment key={account.id}>
                  <tr className="row-clickable" onClick={() => navigate(`/accounts/${account.id}`)}>
                    <td onClick={(e) => e.stopPropagation()}>
                      <ExpandToggle
                        open={expandedId === account.id}
                        onClick={() => setExpandedId((id) => (id === account.id ? null : account.id))}
                      />
                    </td>
                    <td>{account.name}</td>
                    <td>{account.industry}</td>
                    <td className="num">{account.employees.toLocaleString()}</td>
                    <td className="num">{formatCurrency(account.revenue)}</td>
                    <td>{users.find((u) => u.id === account.ownerId)?.name ?? '—'}</td>
                    <td>
                      {account.website ? (
                        // Opens a new tab — practices window/tab handling.
                        <a href={account.website} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                          Visit site ↗
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                  <ExpandPanelRow colSpan={7} expanded={expandedId === account.id}>
                    <AccountExpandPanel account={account} />
                  </ExpandPanelRow>
                </Fragment>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="empty-cell">
                    No accounts match “{query}”.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {layoutPickerOpen && (
        <LayoutPickerPanel module="accounts" basePath="/accounts" onClose={() => setLayoutPickerOpen(false)} />
      )}
    </div>
  );
}
