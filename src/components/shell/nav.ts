import {
  Activity as ActivityIcon, Building2, CalendarDays, CheckSquare, Database, LayoutDashboard, Megaphone, Package, Receipt, Target, Ticket, TrendingUp, User,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

/** The side menu. Setup, Profile settings and Log out live in the profile menu at the top right. */
export const NAV_GROUPS: NavGroup[] = [
  { label: 'Home', items: [{ to: '/', label: 'Dashboard', icon: LayoutDashboard }, { to: '/activity', label: 'Activity', icon: ActivityIcon }] },
  {
    label: 'Customers',
    items: [
      { to: '/leads', label: 'Leads', icon: Target },
      { to: '/contacts', label: 'Contacts', icon: User },
      { to: '/accounts', label: 'Accounts', icon: Building2 },
    ],
  },
  {
    label: 'Sales',
    items: [
      { to: '/deals', label: 'Deals', icon: TrendingUp },
      { to: '/quotes', label: 'Quotes', icon: Receipt },
      { to: '/products', label: 'Products', icon: Package },
      { to: '/campaigns', label: 'Campaigns', icon: Megaphone },
    ],
  },
  {
    label: 'Service',
    items: [
      { to: '/tasks', label: 'Tasks', icon: CheckSquare },
      { to: '/calendar', label: 'Calendar', icon: CalendarDays },
      { to: '/tickets', label: 'Tickets', icon: Ticket },
    ],
  },
  { label: 'Insights', items: [{ to: '/data-studio', label: 'Data Studio', icon: Database }] },
];

/** Pages that are not in the side menu but still need a name in the top bar. */
const OTHER_PAGES: Record<string, string> = {
  setup: 'Setup',
  admin: 'Setup',
  settings: 'Profile settings',
  testcases: 'Test cases',
  forbidden: 'No access',
};

export interface PagePlace {
  group: string | null;
  label: string;
  /** Set on a single record's page, for example /leads/L-1. */
  recordId: string | null;
  to: string;
}

/** Where an address sits in the app: its menu group and page name, for the top bar. */
export function placeForPath(pathname: string): PagePlace {
  const [section = '', second] = pathname.split('/').filter(Boolean);
  if (!section || section === 'dashboard') return { group: 'Home', label: 'Dashboard', recordId: null, to: '/' };
  for (const group of NAV_GROUPS) {
    const item = group.items.find((i) => i.to === `/${section}`);
    if (item) {
      const recordId = second && second !== 'new' && section !== 'data-studio' ? second : null;
      return { group: group.label, label: item.label, recordId, to: item.to };
    }
  }
  return { group: null, label: OTHER_PAGES[section] ?? 'Page not found', recordId: null, to: `/${section}` };
}

/** A count stays readable in a narrow badge (the unread count on the bell). The side menu itself shows no counts. */
export const badgeText = (count: number) => (count > 99 ? '99+' : String(count));
