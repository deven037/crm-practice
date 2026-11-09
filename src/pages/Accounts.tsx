import { Fragment, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { getAll } from '../data/store';
import { Account, Role, User } from '../types';
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

export function filterAccounts(accounts: Account[], query: string, role: Role | undefined) {
  const q = query.trim().toLowerCase();
  if (!q) return accounts;
  const showDetails = role === 'admin' || role === 'rep';
  const digits = /^[\d\s\-()+.]+$/.test(q) ? q.replace(/\D/g, '') : '';
  return accounts.filter((a) => a.name.toLowerCase().includes(q) ||
    (showDetails && digits.length >= 2 && a.phone.replace(/\D/g, '').includes(digits)));
}

export function canWriteAccounts(role: Role | undefined) {
  return role === 'admin' || role === 'rep';
}

export function accountsEmptyKind(total: number, query: string): 'none-yet' | 'no-match' {
  return total === 0 && !query.trim() ? 'none-yet' : 'no-match';
}

// Owner names are optional: roles without Users access (Viewer) still get the accounts.
export async function loadAccountsWithOwners(load: <T>(module: string) => Promise<T[]>) {
  const [accounts, users] = await Promise.all([load<Account>('accounts'), load<User>('users').catch((): User[] => [])]);
  return { accounts, users };
}

export function Accounts() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [params] = useSearchParams();
  // Header search "See all": /accounts?q=term opens the list already filtered.
  const [query, setQuery] = useState(params.get('q') ?? '');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [layoutPickerOpen, setLayoutPickerOpen] = useState(false);

  const urlQuery = params.get('q') ?? '';
  useEffect(() => {
    setQuery(urlQuery);
  }, [urlQuery, location.state]);

  const [loadError, setLoadError] = useState(false);
  const canWrite = canWriteAccounts(user?.role);

  const load = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const { accounts: a, users: u } = await loadAccountsWithOwners(getAll);
      setAccounts(a);
      setUsers(u);
    } catch {
      setLoadError(true);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => filterAccounts(accounts, query, user?.role), [accounts, query, user?.role]);

  return (
    <div data-testid="accounts-page">
      <div className="page-header">
        <div>
          <h1>Accounts</h1>
          <p className="page-subtitle">Customer organisations and the people and deals tied to them.</p>
        </div>
        <div className="page-actions">
          {canWrite && (
            <button className="btn contacts-primary" onClick={() => setLayoutPickerOpen(true)}>
              + New Account
            </button>
          )}
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
          aria-label="Search accounts"
          placeholder="Search by name or industry…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {!loading && !loadError && (
          <span className="muted" role="status">
            {filtered.length} {filtered.length === 1 ? 'account' : 'accounts'}
          </span>
        )}
      </div>
      {loading ? (
        <SkeletonRows rows={8} />
      ) : loadError ? (
        <div className="banner banner-error contacts-error" role="alert" data-testid="accounts-load-error">
          <p>Accounts couldn’t load. Check your connection and try again.</p>
          <button type="button" className="btn" onClick={load}>
            Retry
          </button>
        </div>
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
                    <td>
                      <Link to={`/accounts/${account.id}`} onClick={(e) => e.stopPropagation()}>
                        {account.name}
                      </Link>
                    </td>
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
            </tbody>
          </table>
        </div>
      )}

      {!loading && !loadError && filtered.length === 0 &&
        (accountsEmptyKind(accounts.length, query) === 'none-yet' ? (
          <div className="empty-cell" data-testid="accounts-empty">
            <strong>No accounts yet</strong>
            <p>Add the first customer organisation to start linking contacts and deals.</p>
            {canWrite && (
              <button className="btn contacts-primary" onClick={() => setLayoutPickerOpen(true)}>
                + New Account
              </button>
            )}
          </div>
        ) : (
          <div className="empty-cell">
            <strong>No accounts match “{query}”</strong>
            <p>
              {accounts.length > 0
                ? `Check the spelling, or clear the search to see all ${accounts.length} accounts.`
                : 'Check the spelling and try again.'}
            </p>
            <button type="button" className="btn" onClick={() => setQuery('')}>
              Clear search
            </button>
          </div>
        ))}

      {layoutPickerOpen && (
        <LayoutPickerPanel module="accounts" basePath="/accounts" onClose={() => setLayoutPickerOpen(false)} />
      )}
    </div>
  );
}
