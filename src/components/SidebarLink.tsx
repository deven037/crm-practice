import type { MouseEventHandler, ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { motion } from 'motion/react';

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
      title={collapsed ? label : undefined}
      onClick={onClick}
    >
      {({ isActive }) => (
        <>
          {/* One highlight shared by every link: it glides to whichever link is active. */}
          {isActive && <motion.span layoutId="nav-pill" className="nav-pill" transition={{ type: 'spring', stiffness: 520, damping: 40 }} />}
          <span className="nav-icon">{icon}</span>
          {!collapsed && <span className="nav-label">{label}</span>}
        </>
      )}
    </NavLink>
  );
}
