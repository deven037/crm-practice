import { ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface SlideOverProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  side?: 'left' | 'right';
  testId?: string;
}

/** Drawer-from-edge primitive — same overlay/Escape/click-outside contract as Modal.tsx. */
export function SlideOver({ title, onClose, children, footer, side = 'right', testId }: SlideOverProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return createPortal(
    <div
      className="slideover-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`slideover-panel${side === 'left' ? ' side-left' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-testid={testId ?? 'slideover'}
      >
        <div className="slideover-head">
          <h3 style={{ margin: 0 }}>{title}</h3>
          <button className="modal-close" aria-label="Close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="slideover-body">{children}</div>
        {footer && <footer className="modal-footer">{footer}</footer>}
      </div>
    </div>,
    document.body
  );
}
