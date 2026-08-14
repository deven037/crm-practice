import { ReactNode } from 'react';
import { X } from 'lucide-react';

interface BulkActionsBarProps {
  count: number;
  onClear: () => void;
  children: ReactNode;
}

/** Floating contextual toolbar shown when list rows are multi-selected. */
export function BulkActionsBar({ count, onClear, children }: BulkActionsBarProps) {
  if (count === 0) return null;
  return (
    <div className="bulk-actions-bar" data-testid="bulk-actions-bar">
      <strong>{count} selected</strong>
      {children}
      <button className="icon-btn" aria-label="Clear selection" onClick={onClear} style={{ marginLeft: 'auto', color: '#fff' }}>
        <X size={16} />
      </button>
    </div>
  );
}
