import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, Wrench } from 'lucide-react';

export interface ToolBoxLink {
  label: string;
  to: string;
}

/** The module's set-up shortcuts (rules, status codes, import, fields, layout) behind one button in the page header. */
export function ToolBoxMenu({ links }: { links: ToolBoxLink[] }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (links.length === 0) return null;
  return (
    <span className="toolbox-menu" ref={wrap}>
      <button type="button" className="btn" aria-haspopup="menu" aria-expanded={open} data-testid="toolbox-menu" onClick={() => setOpen((o) => !o)}>
        <Wrench size={16} /> ToolBox <ChevronDown size={14} />
      </button>
      {open && (
        <div className="toolbox-menu-pop" role="menu">
          {links.map((link) => (
            <Link key={link.to} to={link.to} role="menuitem" className="toolbox-menu-link" onClick={() => setOpen(false)}>
              {link.label}
            </Link>
          ))}
        </div>
      )}
    </span>
  );
}
