import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAll } from '../data/store';
import { Account, User } from '../types';
import { SkeletonRows } from '../components/Spinner';
import { formatCurrency } from '../utils';

export function Accounts() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [query, setQuery] = useState('');

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
          <button className="btn btn-primary" onClick={() => navigate('/accounts/new')}>
            + New Account
          </button>
        </div>
      </div>
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
                <tr key={account.id} className="row-clickable" onClick={() => navigate(`/accounts/${account.id}`)}>
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
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty-cell">
                    No accounts match “{query}”.
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
