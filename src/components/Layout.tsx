import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Bell, Building2, CheckSquare, ChevronDown, ChevronRight, DollarSign, FlaskConical, LayoutDashboard,
  LogOut, Megaphone, Menu, Moon, Package, Receipt, Search, Settings, Shield, Sun, Target, Ticket, User,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { getAllSync, getValue, setValue } from '../data/store';
import { AppNotification } from '../types';
import { initials, timeAgo } from '../utils';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { CommandBar } from './CommandBar';
import './feedback-widget';

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

function GlobalSearchTrigger({ onOpen }: { onOpen: () => void }) {
  return (
    <button className="global-search-trigger" data-testid="global-search" onClick={onOpen}>
      <Search size={15} />
      <span>Search leads, contacts, accounts…</span>
      <kbd>⌘K</kbd>
    </button>
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
        <Bell size={18} />
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
          {(user.role === 'admin' || user.role === 'rep') && (
            <button
              data-testid="setup-menu-item"
              onClick={() => {
                setOpen(false);
                navigate('/setup');
              }}
            >
              <Shield size={15} /> Setup
            </button>
          )}
          <button
            onClick={() => {
              setOpen(false);
              navigate('/settings');
            }}
          >
            <Settings size={15} /> Profile settings
          </button>
          <button
            data-testid="logout-btn"
            onClick={() => {
              setOpen(false);
              logout();
              navigate('/login');
            }}
          >
            <LogOut size={15} /> Log out
          </button>
        </div>
      )}
    </div>
  );
}

const NAV_GROUPS: { label: string; items: { to: string; label: string; icon: LucideIcon; adminOnly?: boolean }[] }[] = [
  { label: 'Main', items: [{ to: '/', label: 'Dashboard', icon: LayoutDashboard }] },
  {
    label: 'Sales',
    items: [
      { to: '/leads', label: 'Leads', icon: Target },
      { to: '/contacts', label: 'Contacts', icon: User },
      { to: '/accounts', label: 'Accounts', icon: Building2 },
      { to: '/products', label: 'Products', icon: Package },
      { to: '/campaigns', label: 'Campaigns', icon: Megaphone },
      { to: '/quotes', label: 'Quotes', icon: Receipt },
      { to: '/deals', label: 'Deals', icon: DollarSign },
    ],
  },
  {
    label: 'Work',
    items: [
      { to: '/tasks', label: 'Tasks', icon: CheckSquare },
      { to: '/tickets', label: 'Tickets', icon: Ticket },
    ],
  },
  {
    label: 'System',
    items: [
      { to: '/testcases', label: 'Test Cases', icon: FlaskConical },
      { to: '/settings', label: 'Settings', icon: Settings },
    ],
  },
];

export function Layout({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [closedGroups, setClosedGroups] = useState<string[]>([]);
  const [theme, setTheme] = useState<string>(() => getValue('theme', 'light'));
  const [commandOpen, setCommandOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const isMobile = useMediaQuery('(max-width: 780px)');

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    setValue('theme', theme);
  }, [theme]);

  useEffect(() => {
    if (!isMobile) setMobileOpen(false);
  }, [isMobile]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandOpen((o) => !o);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const toggleSidebar = () => (isMobile ? setMobileOpen((o) => !o) : setCollapsed((c) => !c));
  const contentCollapsed = collapsed && !isMobile;

  const groups = useMemo(
    () =>
      NAV_GROUPS.map((g) => ({
        ...g,
        items: g.items.filter((i) => !i.adminOnly || user?.role !== 'viewer'),
      })).filter((g) => g.items.length > 0),
    [user]
  );

  return (
    <div className={`app-shell${collapsed ? ' sidebar-collapsed' : ''}${mobileOpen ? ' sidebar-mobile-open' : ''}`}>
      {isMobile && mobileOpen && <div className="sidebar-backdrop" onClick={() => setMobileOpen(false)} />}
      <CommandBar open={commandOpen} onClose={() => setCommandOpen(false)} />
      <aside className="sidebar" data-testid="sidebar">
        <div className="brand">
          <span className="brand-logo">◆</span>
          {!contentCollapsed && <span className="brand-name">Practice CRM</span>}
        </div>
        <nav>
          {groups.map((group) => {
            const closed = closedGroups.includes(group.label);
            return (
              <div key={group.label} className="nav-group">
                {!contentCollapsed && (
                  <button
                    className="nav-group-label"
                    aria-expanded={!closed}
                    onClick={() =>
                      setClosedGroups((c) =>
                        closed ? c.filter((x) => x !== group.label) : [...c, group.label]
                      )
                    }
                  >
                    {group.label} <span className="caret">{closed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}</span>
                  </button>
                )}
                {(contentCollapsed || !closed) &&
                  group.items.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.to === '/'}
                      className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
                      onClick={() => isMobile && setMobileOpen(false)}
                    >
                      <span className="nav-icon">
                        <item.icon size={17} />
                      </span>
                      {!contentCollapsed && <span>{item.label}</span>}
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
            onClick={toggleSidebar}
          >
            <Menu size={18} />
          </button>
          <GlobalSearchTrigger onOpen={() => setCommandOpen(true)} />
          <div className="topbar-right">
            <button
              className="icon-btn"
              aria-label="Toggle theme"
              data-testid="theme-toggle"
              onClick={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}
            >
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
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
