import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Bell, CheckSquare, ChevronsLeft, Home, LogOut, Menu, Moon, Pin, PinOff, Search, Settings, Shield, Sun, Target, X } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { BankProfile, fetchBankProfile, getAllSync, getValue, setValue } from '../data/store';
import { AppNotification, Lead, TaskItem, Ticket } from '../types';
import { initials } from '../utils';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { usePinned } from '../hooks/usePinned';
import { useRecentlyViewed } from '../hooks/useRecentlyViewed';
import { CommandBar, isCloseKey } from './CommandBar';
import { SidebarLink } from './SidebarLink';
import { NotificationsPanel } from './shell/NotificationsPanel';
import { NAV_GROUPS, badgeText, navCounts, placeForPath } from './shell/nav';
import './feedback-widget';
import { applyBankTheme } from '../theme/bankTheme';

const PRODUCT_NAME = import.meta.env.VITE_PRODUCT_NAME?.trim() || 'Harbor CRM';

export function listenForDismiss(
  doc: Document,
  isOutside: (target: Node) => boolean,
  onClose: () => void,
): () => void {
  const onMouseDown = (e: MouseEvent) => {
    if (isOutside(e.target as Node)) onClose();
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (isCloseKey(e.key)) onClose();
  };
  doc.addEventListener('mousedown', onMouseDown);
  doc.addEventListener('keydown', onKeyDown);
  return () => {
    doc.removeEventListener('mousedown', onMouseDown);
    doc.removeEventListener('keydown', onKeyDown);
  };
}

export function closeOnEscape(doc: Document, onClose: () => void): () => void {
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  };
  doc.addEventListener('keydown', onKeyDown, true);
  return () => doc.removeEventListener('keydown', onKeyDown, true);
}

function useOutside(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(
    () => listenForDismiss(document, (target) => !!ref.current && !ref.current.contains(target), onClose),
    [onClose],
  );
  return ref;
}

function GlobalSearchTrigger({ onOpen }: { onOpen: () => void }) {
  return (
    <button className="global-search-trigger" data-testid="global-search" aria-label="Search leads, contacts, accounts" onClick={onOpen}>
      <Search size={16} />
      <span>Search or jump to…</span>
      <kbd>Ctrl K</kbd>
    </button>
  );
}

const ROLE_NAMES: Record<string, string> = { admin: 'Admin', rep: 'Sales rep', viewer: 'Viewer' };

/** The profile chip at the top right: who is signed in, and the way to Setup, Profile settings and Log out. */
function ProfileMenu({ compact }: { compact: boolean }) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const ref = useOutside(() => setOpen(false));
  useEffect(() => (open ? closeOnEscape(document, () => setOpen(false)) : undefined), [open]);
  if (!user) return null;
  const role = ROLE_NAMES[user.role] ?? user.role;
  const goTo = (to: string) => {
    setOpen(false);
    navigate(to);
  };

  return (
    <div className="avatar-wrap" ref={ref}>
      <button
        className={`profile-chip${open ? ' open' : ''}`}
        aria-label="User menu"
        aria-haspopup="menu"
        aria-expanded={open}
        data-testid="avatar-menu"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="avatar-circle">{initials(user.name)}</span>
        {!compact && (
          <span className="profile-chip-text">
            <strong>{user.name}</strong>
            <small>{role}</small>
          </span>
        )}
      </button>
      {open && (
        <div className="avatar-menu" role="menu">
          <div className="avatar-info">
            <strong>{user.name}</strong>
            <span className="muted">
              {user.email} · {role}
            </span>
          </div>
          {(user.role === 'admin' || user.role === 'rep') && (
            <button role="menuitem" data-testid="setup-menu-item" onClick={() => goTo('/setup')}>
              <Shield size={16} /> Setup
            </button>
          )}
          <button role="menuitem" onClick={() => goTo('/settings')}>
            <Settings size={16} /> Profile settings
          </button>
          <button
            role="menuitem"
            data-testid="logout-btn"
            onClick={() => {
              setOpen(false);
              logout();
              navigate('/login');
            }}
          >
            <LogOut size={16} /> Log out
          </button>
        </div>
      )}
    </div>
  );
}

/** "leads" → "Lead", for the small type name beside a pinned record. */
const singular = (module: string) => {
  const word = module.endsWith('s') ? module.slice(0, -1) : module;
  return word.charAt(0).toUpperCase() + word.slice(1);
};

export function Layout({ children, initialSidebarCollapsed = false }: { children: ReactNode; initialSidebarCollapsed?: boolean }) {
  const { user } = useAuth();
  const [collapsed, setCollapsed] = useState<boolean>(() => initialSidebarCollapsed || getValue('sidebarCollapsed', false));
  const [theme, setTheme] = useState<string>(() => getValue('theme', 'light'));
  const [commandOpen, setCommandOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>(() => getAllSync<AppNotification>('notifications'));
  const isMobile = useMediaQuery('(max-width: 780px)');
  const location = useLocation();
  // The module part of the address: the page slides in when it changes, not on every sub-page.
  const section = location.pathname.split('/')[1] ?? '';
  const [profile, setProfile] = useState<BankProfile | null>(null);
  const [profileStatus, setProfileStatus] = useState<'loading' | 'ready' | 'failed'>('loading');

  const loadProfile = () => {
    setProfileStatus('loading');
    fetchBankProfile().then(
      (p) => {
        setProfile(p);
        setProfileStatus(p?.name.trim() ? 'ready' : 'failed');
        // One colour from the bank's profile re-themes the whole app.
        applyBankTheme(p?.color);
      },
      () => setProfileStatus('failed')
    );
  };

  useEffect(loadProfile, []);

  const { items: pinned, toggle: togglePin } = usePinned();
  const { items: recent } = useRecentlyViewed();

  const bankName = profileStatus === 'ready' ? profile?.name.trim() : '';
  const bankLogo = bankName ? profile?.logoUrl?.trim() : null;
  const shownName = bankName || PRODUCT_NAME;

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

  useEffect(() => (notifOpen ? closeOnEscape(document, () => setNotifOpen(false)) : undefined), [notifOpen]);

  const toggleSidebar = () => {
    if (isMobile) {
      setMobileOpen((o) => !o);
      return;
    }
    setCollapsed((c) => {
      setValue('sidebarCollapsed', !c);
      return !c;
    });
  };
  const contentCollapsed = collapsed && !isMobile;

  const place = placeForPath(location.pathname);
  // Counts are read from what the app already holds; they refresh whenever the page changes.
  const counts = useMemo(
    () => navCounts(getAllSync<Lead>('leads'), getAllSync<TaskItem>('tasks'), getAllSync<Ticket>('tickets')),
    [location.pathname]
  );
  const unread = notifications.filter((n) => !n.read).length;

  const changeNotifications = (next: AppNotification[]) => {
    setNotifications(next);
    // Keep the shared copy in step, so other screens and a later visit agree.
    getAllSync<AppNotification>('notifications').forEach((held) => {
      const match = next.find((n) => n.id === held.id);
      if (match) held.read = match.read;
    });
  };

  // A record can be pinned once its page has told the app its name (Recently viewed holds it).
  const openRecord = place.recordId ? recent.find((r) => r.link === location.pathname) : undefined;
  const isPinned = pinned.some((p) => p.link === location.pathname);
  const closeSheet = () => isMobile && setMobileOpen(false);

  return (
    <div data-bank-profile={profileStatus === 'ready' && profile?.color ? 'bank' : 'default'} className={`app-shell${contentCollapsed ? ' sidebar-collapsed' : ''}${mobileOpen ? ' sidebar-mobile-open' : ''}`}>
      {isMobile && mobileOpen && <div className="sidebar-backdrop" onClick={() => setMobileOpen(false)} />}
      <CommandBar open={commandOpen} onClose={() => setCommandOpen(false)} />
      {notifOpen && <NotificationsPanel items={notifications} onChange={changeNotifications} onClose={() => setNotifOpen(false)} />}
      <aside className="sidebar" data-testid="sidebar">
        <div className="brand" title={contentCollapsed ? shownName : undefined}>
          <span className="brand-logo" aria-hidden="true">
            {bankLogo ? <img src={bankLogo} alt="" /> : shownName.charAt(0).toUpperCase()}
          </span>
          {!contentCollapsed && (
            <span className="brand-text">
              <span className="brand-name">{shownName}</span>
              {bankName && <span className="brand-sub">on {PRODUCT_NAME}</span>}
            </span>
          )}
          {contentCollapsed && <span className="sr-only">{shownName}</span>}
          {!isMobile && (
            <button
              className="sidebar-collapse"
              aria-label="Toggle sidebar"
              aria-expanded={!collapsed}
              data-testid="sidebar-toggle"
              onClick={toggleSidebar}
            >
              <ChevronsLeft size={16} />
            </button>
          )}
        </div>
        <nav aria-label="Main">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="nav-group">
              <div className="nav-group-label">{contentCollapsed ? <span className="sr-only">{group.label}</span> : group.label}</div>
              {group.items.map((item) => {
                const count = counts[item.to];
                return (
                  <SidebarLink
                    key={item.to}
                    to={item.to}
                    label={item.label}
                    icon={<item.icon size={18} />}
                    collapsed={contentCollapsed}
                    end={item.to === '/'}
                    badge={count && count.count > 0 ? badgeText(count.count) : undefined}
                    badgeHot={count?.hot}
                    onClick={closeSheet}
                  />
                );
              })}
            </div>
          ))}
          {pinned.length > 0 && !contentCollapsed && (
            <div className="nav-group nav-pinned" data-testid="pinned-records">
              <div className="nav-group-label">Pinned</div>
              {pinned.map((p) => (
                <div key={p.link} className="nav-pin-row">
                  <NavLink to={p.link} className="nav-link nav-pin" onClick={closeSheet}>
                    <span className="nav-icon"><span className="nav-pin-dot" /></span>
                    <span className="nav-label">
                      {p.label} <small>· {singular(p.module)}</small>
                    </span>
                  </NavLink>
                  <button className="nav-pin-remove" aria-label={`Remove ${p.label} from pinned`} onClick={() => togglePin(p)}>
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </nav>
      </aside>
      <div className="main-column">
        <header className="topbar" data-testid="topbar">
          {isMobile ? (
            <div className="topbar-place">
              <span className="brand-logo" aria-hidden="true">
                {bankLogo ? <img src={bankLogo} alt="" /> : shownName.charAt(0).toUpperCase()}
              </span>
              <strong>{place.label}</strong>
            </div>
          ) : (
            <nav className="topbar-place" aria-label="Where you are">
              {place.group && <span>{place.group}</span>}
              {place.group && <span aria-hidden="true">/</span>}
              {place.recordId ? <Link to={place.to}>{place.label}</Link> : <strong>{place.label}</strong>}
              {openRecord && <span aria-hidden="true">/</span>}
              {openRecord && <strong className="topbar-record">{openRecord.label}</strong>}
            </nav>
          )}
          {openRecord && (
            <button
              className={`icon-btn pin-btn${isPinned ? ' pinned' : ''}`}
              aria-label={isPinned ? 'Remove from pinned' : 'Pin to the menu'}
              aria-pressed={isPinned}
              title={isPinned ? 'Remove from pinned' : 'Pin to the menu'}
              data-testid="pin-record"
              onClick={() => togglePin({ module: openRecord.module, id: openRecord.id, label: openRecord.label, link: openRecord.link })}
            >
              {isPinned ? <PinOff size={17} /> : <Pin size={17} />}
            </button>
          )}
          {!isMobile && <GlobalSearchTrigger onOpen={() => setCommandOpen(true)} />}
          <div className="topbar-right">
            <button
              className="icon-btn"
              aria-label="Toggle theme"
              data-testid="theme-toggle"
              onClick={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}
            >
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            <button className="icon-btn bell-btn" aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'} data-testid="notifications-bell" onClick={() => setNotifOpen(true)}>
              <Bell size={18} />
              {unread > 0 && <span className="bell-badge" key={unread}>{badgeText(unread)}</span>}
            </button>
            <ProfileMenu compact={isMobile} />
          </div>
        </header>
        {profileStatus === 'failed' && (
          <div className="banner banner-error profile-banner" role="alert" data-testid="bank-profile-error">
            <div>
              <strong>Your bank's name and colours didn't load</strong>
              <p>You're seeing the standard {PRODUCT_NAME} look. Your data is not affected.</p>
            </div>
            <button className="btn" data-testid="bank-profile-retry" onClick={loadProfile}>
              Retry
            </button>
          </div>
        )}
        <main className="page v3-page-enter" key={section}>{children}</main>
      </div>
      {isMobile && (
        <nav className="tabbar" aria-label="Quick menu" data-testid="tabbar">
          <NavLink to="/" end className={({ isActive }) => `tabbar-item${isActive ? ' active' : ''}`}>
            <Home size={20} /> Home
          </NavLink>
          <NavLink to="/leads" className={({ isActive }) => `tabbar-item${isActive ? ' active' : ''}`}>
            <Target size={20} /> Leads
          </NavLink>
          <button className="tabbar-search" data-testid="global-search" aria-label="Search leads, contacts, accounts" onClick={() => setCommandOpen(true)}>
            <Search size={22} />
          </button>
          <NavLink to="/tasks" className={({ isActive }) => `tabbar-item${isActive ? ' active' : ''}`}>
            <CheckSquare size={20} /> Tasks
          </NavLink>
          <button className={`tabbar-item${mobileOpen ? ' active' : ''}`} aria-label="Toggle sidebar" aria-expanded={mobileOpen} data-testid="sidebar-toggle" onClick={toggleSidebar}>
            <Menu size={20} /> Menu
          </button>
        </nav>
      )}
      <feedback-widget />
    </div>
  );
}
