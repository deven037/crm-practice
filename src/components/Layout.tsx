import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { getAllSync, getValue, setValue } from '../data/store';
import { Account, AppNotification, Contact, Deal, Lead, Product } from '../types';
import { initials, timeAgo } from '../utils';
import './feedback-widget';

interface SearchResult {
  type: string;
  id: string;
  label: string;
  link: string;
}

function useOutside(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);
  return ref;
}

function GlobalSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const ref = useOutside(() => setOpen(false));

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    setOpen(true);
    const timer = setTimeout(() => {
      const q = query.trim().toLowerCase();
      const found: SearchResult[] = [
        ...getAllSync<Lead>('leads')
          .filter((l) => l.name.toLowerCase().includes(q) || l.company.toLowerCase().includes(q))
          .slice(0, 4)
          .map((l) => ({ type: 'Lead', id: l.id, label: `${l.name} · ${l.company}`, link: '/leads' })),
        ...getAllSync<Contact>('contacts')
          .filter((c) => c.name.toLowerCase().includes(q))
          .slice(0, 4)
          .map((c) => ({ type: 'Contact', id: c.id, label: c.name, link: `/contacts/${c.id}` })),
        ...getAllSync<Account>('accounts')
          .filter((a) => a.name.toLowerCase().includes(q))
          .slice(0, 3)
          .map((a) => ({ type: 'Account', id: a.id, label: a.name, link: `/accounts/${a.id}` })),
        ...getAllSync<Product>('products')
          .filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))
          .slice(0, 3)
          .map((p) => ({ type: 'Product', id: p.id, label: `${p.name} (${p.sku})`, link: `/products/${p.id}` })),
        ...getAllSync<Deal>('deals')
          .filter((d) => d.name.toLowerCase().includes(q))
          .slice(0, 3)
          .map((d) => ({ type: 'Deal', id: d.id, label: d.name, link: `/deals/${d.id}` })),
      ];
      setResults(found);
      setSearching(false);
    }, 600); // simulated async search latency
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div className="global-search" ref={ref}>
      <input
        type="search"
        className="input"
        placeholder="Search leads, contacts, accounts…"
        data-testid="global-search"
        value={query}
        onFocus={() => query.trim().length >= 2 && setOpen(true)}
        onChange={(e) => setQuery(e.target.value)}
      />
      {open && (
        <div className="search-dropdown">
          {searching && <div className="search-hint">Searching…</div>}
          {!searching && results && results.length === 0 && <div className="search-hint">No results for “{query}”</div>}
          {!searching &&
            results?.map((r) => (
              <button
                key={`${r.type}-${r.id}`}
                className="search-result"
                onClick={() => {
                  setOpen(false);
                  setQuery('');
                  navigate(r.link);
                }}
              >
                <span className="search-type">{r.type}</span> {r.label}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

function NotificationsBell() {
  const [items, setItems] = useState<AppNotification[]>(() => getAllSync<AppNotification>('notifications'));
  const [open, setOpen] = useState(false);
  const ref = useOutside(() => setOpen(false));
  const unread = items.filter((n) => !n.read).length;

  const markAllRead = () => {
    const next = items.map((n) => ({ ...n, read: true }));
    setItems(next);
    setValue('notifications', next);
  };

  return (
    <div className="bell-wrap" ref={ref}>
      <button className="icon-btn" aria-label="Notifications" onClick={() => setOpen((o) => !o)}>
        🔔
        {unread > 0 && <span className="bell-badge">{unread}</span>}
      </button>
      {open && (
        <div className="notif-panel">
          <div className="notif-head">
            <strong>Notifications</strong>
            <button className="link-btn" onClick={markAllRead} disabled={unread === 0}>
              Mark all read
            </button>
          </div>
          {items.length === 0 && <div className="search-hint">No notifications</div>}
          {items.map((n) => (
            <div key={n.id} className={`notif-item${n.read ? '' : ' unread'}`}>
              <span>{n.text}</span>
              <span className="notif-time">{timeAgo(n.when)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AvatarMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const ref = useOutside(() => setOpen(false));
  if (!user) return null;

  return (
    <div className="avatar-wrap" ref={ref}>
      <button className="avatar-btn" aria-label="User menu" data-testid="avatar-menu" onClick={() => setOpen((o) => !o)}>
        <span className="avatar-circle">{initials(user.name)}</span>
      </button>
      {open && (
        <div className="avatar-menu">
          <div className="avatar-info">
            <strong>{user.name}</strong>
            <span className="muted">
              {user.email} · {user.role}
            </span>
          </div>
          <button
            onClick={() => {
              setOpen(false);
              navigate('/settings');
            }}
          >
            Profile settings
          </button>
          <button
            data-testid="logout-btn"
            onClick={() => {
              setOpen(false);
              logout();
              navigate('/login');
            }}
          >
            Log out
          </button>
        </div>
      )}
    </div>
  );
}

const NAV_GROUPS: { label: string; items: { to: string; label: string; icon: string; adminOnly?: boolean }[] }[] = [
  { label: 'Main', items: [{ to: '/', label: 'Dashboard', icon: '📊' }] },
  {
    label: 'Sales',
    items: [
      { to: '/leads', label: 'Leads', icon: '🎯' },
      { to: '/contacts', label: 'Contacts', icon: '👤' },
      { to: '/accounts', label: 'Accounts', icon: '🏢' },
      { to: '/products', label: 'Products', icon: '📦' },
      { to: '/deals', label: 'Deals', icon: '💰' },
    ],
  },
  {
    label: 'Work',
    items: [
      { to: '/tasks', label: 'Tasks', icon: '✅' },
      { to: '/tickets', label: 'Tickets', icon: '🎫' },
    ],
  },
  {
    label: 'System',
    items: [
      { to: '/admin', label: 'Admin', icon: '🛡️', adminOnly: true },
      { to: '/settings', label: 'Settings', icon: '⚙️' },
    ],
  },
];

export function Layout({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [closedGroups, setClosedGroups] = useState<string[]>([]);
  const [theme, setTheme] = useState<string>(() => getValue('theme', 'light'));

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    setValue('theme', theme);
  }, [theme]);

  const groups = useMemo(
    () =>
      NAV_GROUPS.map((g) => ({
        ...g,
        items: g.items.filter((i) => !i.adminOnly || user?.role !== 'viewer'),
      })).filter((g) => g.items.length > 0),
    [user]
  );

  return (
    <div className={`app-shell${collapsed ? ' sidebar-collapsed' : ''}`}>
      <aside className="sidebar" data-testid="sidebar">
        <div className="brand">
          <span className="brand-logo">◆</span>
          {!collapsed && <span className="brand-name">Practice CRM</span>}
        </div>
        <nav>
          {groups.map((group) => {
            const closed = closedGroups.includes(group.label);
            return (
              <div key={group.label} className="nav-group">
                {!collapsed && (
                  <button
                    className="nav-group-label"
                    aria-expanded={!closed}
                    onClick={() =>
                      setClosedGroups((c) =>
                        closed ? c.filter((x) => x !== group.label) : [...c, group.label]
                      )
                    }
                  >
                    {group.label} <span className="caret">{closed ? '▸' : '▾'}</span>
                  </button>
                )}
                {(collapsed || !closed) &&
                  group.items.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.to === '/'}
                      className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
                    >
                      <span className="nav-icon">{item.icon}</span>
                      {!collapsed && <span>{item.label}</span>}
                    </NavLink>
                  ))}
              </div>
            );
          })}
        </nav>
      </aside>
      <div className="main-column">
        <header className="topbar" data-testid="topbar">
          <button
            className="icon-btn"
            aria-label="Toggle sidebar"
            data-testid="sidebar-toggle"
            onClick={() => setCollapsed((c) => !c)}
          >
            ☰
          </button>
          <GlobalSearch />
          <div className="topbar-right">
            <button
              className="icon-btn"
              aria-label="Toggle theme"
              data-testid="theme-toggle"
              onClick={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}
            >
              {theme === 'light' ? '🌙' : '☀️'}
            </button>
            <NotificationsBell />
            <AvatarMenu />
          </div>
        </header>
        <main className="page">{children}</main>
      </div>
      <feedback-widget />
    </div>
  );
}
