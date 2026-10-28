import type { MouseEventHandler, ReactNode } from 'react';
import { NavLink } from 'react-router-dom';

type SidebarLinkProps = {
  to: string;
  label: string;
  icon: ReactNode;
  collapsed: boolean;
  end?: boolean;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
};

export function SidebarLink({ to, label, icon, collapsed, end, onClick }: SidebarLinkProps) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
      aria-label={label}
      onClick={onClick}
    >
      <span className="nav-icon">{icon}</span>
      {!collapsed && <span>{label}</span>}
    </NavLink>
  );
}
