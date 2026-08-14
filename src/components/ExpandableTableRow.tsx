import { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';

export function ExpandToggle({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <button
      className={`expand-toggle${open ? ' open' : ''}`}
      aria-label={open ? 'Collapse row' : 'Expand row'}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <ChevronRight size={16} />
    </button>
  );
}

export function ExpandPanelRow({ colSpan, expanded, children }: { colSpan: number; expanded: boolean; children: ReactNode }) {
  if (!expanded) return null;
  return (
    <tr>
      <td colSpan={colSpan} style={{ padding: 0 }}>
        <div className="expand-panel">{children}</div>
      </td>
    </tr>
  );
}
