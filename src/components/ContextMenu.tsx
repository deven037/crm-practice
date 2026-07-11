import { useEffect } from 'react';
import { createPortal } from 'react-dom';

export interface ContextMenuItem {
  label: string;
  onClick: () => void;
  danger?: boolean;
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

/** Right-click menu — intentionally has no test IDs; locate items by text. */
export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  useEffect(() => {
    const close = () => onClose();
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('click', close);
    document.addEventListener('contextmenu', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('click', close);
      document.removeEventListener('contextmenu', close);
      document.removeEventListener('keydown', esc);
    };
  }, [onClose]);

  return createPortal(
    <ul className="context-menu" role="menu" style={{ top: y, left: x }}>
      {items.map((item) => (
        <li
          key={item.label}
          role="menuitem"
          className={item.danger ? 'danger' : ''}
          onClick={() => {
            onClose();
            item.onClick();
          }}
        >
          {item.label}
        </li>
      ))}
    </ul>,
    document.body
  );
}
