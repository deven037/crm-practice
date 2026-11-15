import { ReactNode, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

let modalCount = 0;

// Where Tab/Shift+Tab should go to stay inside the dialog; null lets the browser move focus normally.
export function trapTarget<T>(focusables: T[], dialog: T, active: unknown, shift: boolean): T | null {
  if (focusables.length === 0) return dialog;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  if (shift && (active === first || active === dialog)) return last;
  if (!shift && active === last) return first;
  return null;
}

export function Modal({ title, onClose, children, footer, wide }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const idRef = useRef<string | null>(null);
  if (idRef.current === null) idRef.current = `modal-body-${++modalCount}`;
  const bodyId = idRef.current;
  // Captured during the first render, before any autoFocus field inside the dialog takes focus.
  const openerRef = useRef<HTMLElement | null | undefined>(undefined);
  if (openerRef.current === undefined) openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;

  useEffect(() => {
    const dialog = dialogRef.current;
    const opener = openerRef.current;
    if (dialog && !dialog.contains(document.activeElement)) dialog.focus();
    return () => {
      if (opener && opener.isConnected) opener.focus();
    };
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      const dialog = dialogRef.current;
      if (e.key !== 'Tab' || !dialog) return;
      const focusables = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE));
      const target = trapTarget(focusables, dialog, document.activeElement, e.shiftKey);
      if (target) {
        e.preventDefault();
        target.focus();
      } else if (!dialog.contains(document.activeElement)) {
        e.preventDefault();
        dialog.focus();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return createPortal(
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className={`modal${wide ? ' modal-wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        aria-describedby={bodyId}
        data-testid="modal"
      >
        <header className="modal-header">
          <h3>{title}</h3>
          <button className="modal-close" aria-label="Close dialog" onClick={onClose}>
            ×
          </button>
        </header>
        <div className="modal-body" id={bodyId}>{children}</div>
        {footer && <footer className="modal-footer">{footer}</footer>}
      </div>
    </div>,
    document.body
  );
}
