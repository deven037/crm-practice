import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowUpRight, ChevronDown, ChevronRight, LayoutDashboard, List, Plus, Search } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { getAll } from '../data/store';
import { Account, Deal, Role, User } from '../types';
import { SkeletonRows } from '../components/Spinner';
import { LayoutPickerPanel } from '../components/LayoutPickerPanel';
import { ToolBoxMenu } from '../components/ToolBoxMenu';
import { Select } from '../components/Select';
import { useAccountRelated } from '../hooks/useAccountRelated';
import { classNames } from '../utils';
import { TagPicker } from './contacts/contactBits';
import { AccountCrest, AccountSort, filterByIndustry, industryStyle, isOpenDeal, openPipeline, PortfolioMap, shortMoney, sortAccounts, useNarrow } from './accounts/accountBits';

/** The module's set-up shortcuts, shown under the ToolBox button. */
export const ACCOUNT_TOOLBOX_LINKS = [
  { label: 'Import Data', to: '/setup/import' },
  { label: 'Custom Fields', to: '/admin/objects/accounts' },
  { label: 'Customise Page Layout', to: '/setup/layouts/accounts' },
];

const SORT_OPTIONS: { value: AccountSort; label: string }[] = [
  { value: 'revenue', label: 'Largest revenue' },
  { value: 'employees', label: 'Most employees' },
  { value: 'name', label: 'Name A to Z' },
];

/** What a ledger line shows when it is opened: the numbers behind the account, without leaving the list. */
function AccountExpandPanel({ account }: { account: Account }) {
  const { contacts, deals, quotes, loading } = useAccountRelated(account.id);

  if (loading) return <div className="acct-more"><span className="muted">Loading…</span></div>;

  return (
    <div className="acct-more" data-testid="account-expand-panel">
      <div><span>Phone</span><b>{account.phone || '—'}</b></div>
      <div><span>Contacts</span><b>{contacts.length}</b></div>
      <div><span>Deals</span><b>{deals.length}</b></div>
      <div><span>Quotes</span><b>{quotes.length}</b></div>
      <div><span>Open pipeline</span><b>{shortMoney(openPipeline(deals))}</b></div>
      <div><Link className="btn" to={`/accounts/${account.id}`}>Open account <ChevronRight size={15} aria-hidden="true" /></Link></div>
    </div>
  );
}

export function filterAccounts(accounts: Account[], query: string, role: Role | undefined) {
  const q = query.trim().toLowerCase();
  if (!q) return accounts;
  const showDetails = role === 'admin' || role === 'rep';
  const digits = /^[\d\s\-()+.]+$/.test(q) ? q.replace(/\D/g, '') : '';
  return accounts.filter((a) => a.name.toLowerCase().includes(q) ||
    a.industry.toLowerCase().includes(q) ||
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
  const [deals, setDeals] = useState<Deal[]>([]);
  const [view, setView] = useState<'map' | 'ledger'>('map');
  const [sort, setSort] = useState<AccountSort>('revenue');
  const [industries, setIndustries] = useState<string[]>([]);
  const narrow = useNarrow();
  const canWrite = canWriteAccounts(user?.role);

  const load = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const { accounts: a, users: u } = await loadAccountsWithOwners(getAll);
      setAccounts(a);
      setUsers(u);
      // Deals only feed the summary line and the tiles; the page still works without them.
      setDeals(await getAll<Deal>('deals').catch((): Deal[] => []));
    } catch {
      setLoadError(true);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(
    () => sortAccounts(filterByIndustry(filterAccounts(accounts, query, user?.role), industries), sort),
    [accounts, query, user?.role, industries, sort],
  );
  const ready = !loading && !loadError;
  const showMap = view === 'map' && !narrow;
  const shownIds = new Set(filtered.map((a) => a.id));
  const openDeals = deals.filter((d) => d.accountId && shownIds.has(d.accountId) && isOpenDeal(d));
  const totalRevenue = filtered.reduce((sum, a) => sum + a.revenue, 0);
  const maxRevenue = Math.max(1, ...accounts.map((a) => a.revenue));
  const allIndustries = [...new Set(accounts.map((a) => a.industry).filter(Boolean))].sort();
  const filtering = query.trim() !== '' || industries.length > 0;

  return (
    <div className="acct3 acct-list" data-testid="accounts-page">
      <div className="page-header">
        <div>
          <h1>Accounts</h1>
          <p className="page-subtitle">Customer organisations and the people and deals tied to them.</p>
        </div>
        <div className="page-actions">
          <ToolBoxMenu links={ACCOUNT_TOOLBOX_LINKS} />
          {canWrite && (
            <button className="btn btn-primary contacts-primary" data-testid="new-account" onClick={() => setLayoutPickerOpen(true)}>
              <Plus size={16} /> New account
            </button>
          )}
        </div>
      </div>

      {ready && (
        <div className="acct-sum" role="status">
          <span><b>{filtered.length}</b>{filtered.length === 1 ? 'account' : 'accounts'}</span>
          <span><b>{shortMoney(totalRevenue)}</b>combined annual revenue</span>
          <span><b>{openDeals.length}</b>open {openDeals.length === 1 ? 'deal' : 'deals'}</span>
        </div>
      )}

      <div className="toolbar contact-tools">
        <div className="contact-find">
          <Search size={17} aria-hidden="true" />
          <input
            type="search"
            className="input search-input"
            aria-label="Search accounts"
            placeholder="Search by name or industry…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <TagPicker
          testId="industry-filter"
          label={<>Industry{industries.length ? ` · ${industries.length}` : ''} <ChevronDown size={14} aria-hidden="true" /></>}
          tags={allIndustries}
          selected={industries}
          onToggle={(name) => setIndustries((list) => (list.includes(name) ? list.filter((t) => t !== name) : [...list, name]))}
        />
        {filtering && (
          <button type="button" className="btn btn-ghost" data-testid="clear-filters" onClick={() => { setQuery(''); setIndustries([]); }}>
            Clear
          </button>
        )}
        <span className="contact-tools-gap" />
        {!showMap && (
          <div className="acct-sort">
            <Select value={sort} options={SORT_OPTIONS} onChange={(v) => setSort(v as AccountSort)} testId="account-sort" />
          </div>
        )}
        <div className="seg contact-seg acct-viewseg" role="group" aria-label="View mode">
          <button type="button" aria-pressed={view === 'map'} data-testid="view-map" onClick={() => setView('map')}>
            <LayoutDashboard size={14} /> Map
          </button>
          <button type="button" aria-pressed={view === 'ledger'} data-testid="view-ledger" onClick={() => setView('ledger')}>
            <List size={14} /> Ledger
          </button>
        </div>
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
      ) : filtered.length > 0 && (showMap ? (
        <PortfolioMap accounts={filtered} deals={deals} />
      ) : (
        <div className="card acct-ledger" data-testid="accounts-ledger">
          <div className="acct-row acct-row-head">
            <span />
            <span>Account</span>
            <span className="acct-num">Employees</span>
            <span>Annual revenue</span>
            <span>Owner</span>
            <span>Website</span>
          </div>
          {filtered.map((account, index) => {
            const open = expandedId === account.id;
            return (
              <div
                key={account.id}
                className={classNames('acct-line', open && 'open')}
                style={{ ...industryStyle(account.industry), animationDelay: `${Math.min(index, 14) * 24}ms` }}
              >
                <div className="acct-row acct-row-body" data-testid="account-row" onClick={() => navigate(`/accounts/${account.id}`)}>
                  <button
                    type="button"
                    className="acct-chev"
                    aria-expanded={open}
                    aria-label={`${open ? 'Hide' : 'Show'} more about ${account.name}`}
                    data-testid="account-expand"
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedId((id) => (id === account.id ? null : account.id));
                    }}
                  >
                    <ChevronRight size={16} aria-hidden="true" />
                  </button>
                  <div className="acct-org">
                    <AccountCrest account={account} />
                    <div>
                      <Link to={`/accounts/${account.id}`} onClick={(e) => e.stopPropagation()}>
                        {account.name}
                      </Link>
                      <small>{account.industry}</small>
                    </div>
                  </div>
                  <span className="acct-num">{account.employees.toLocaleString()}</span>
                  <div className="acct-bar">
                    <b>{shortMoney(account.revenue)}</b>
                    <i><span style={{ width: `${Math.max(3, (account.revenue / maxRevenue) * 100)}%` }} /></i>
                  </div>
                  <span>{users.find((u) => u.id === account.ownerId)?.name ?? '—'}</span>
                  <span>
                    {account.website ? (
                      // Opens a new tab — practices window/tab handling.
                      <a className="acct-link" href={account.website} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                        Visit site <ArrowUpRight size={13} aria-hidden="true" />
                      </a>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </span>
                </div>
                {open && <AccountExpandPanel account={account} />}
              </div>
            );
          })}
        </div>
      ))}

      {ready && filtered.length === 0 &&
        (accountsEmptyKind(accounts.length, query) === 'none-yet' && industries.length === 0 ? (
          <div className="empty-cell" data-testid="accounts-empty">
            <strong>No accounts yet</strong>
            <p>Add the first customer organisation to start linking contacts and deals.</p>
            {canWrite && (
              <button className="btn btn-primary contacts-primary" onClick={() => setLayoutPickerOpen(true)}>
                <Plus size={16} /> New account
              </button>
            )}
          </div>
        ) : (
          <div className="empty-cell" data-testid="accounts-no-match">
            <strong>{query.trim() ? `No accounts match “${query}”` : 'No accounts in these industries'}</strong>
            <p>
              {accounts.length > 0
                ? `Check the spelling, or clear the search to see all ${accounts.length} accounts.`
                : 'Check the spelling and try again.'}
            </p>
            <button type="button" className="btn" onClick={() => { setQuery(''); setIndustries([]); }}>
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
