import { createContext, ReactNode, useCallback, useContext, useRef, useState } from 'react';
import { Info, XCircle } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { SavedTick } from './v3';

export type ToastType = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

const ToastContext = createContext<{ push: (type: ToastType, message: string) => void }>({
  push: () => {},
});


export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const push = useCallback((type: ToastType, message: string) => {
    const id = ++counter.current;
    setToasts((t) => [...t, { id, type, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="toast-container" data-testid="toast-container" aria-live="polite">
        <AnimatePresence initial={false}>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            layout
            initial={{ opacity: 0, x: 48, scale: 0.94 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 48, scale: 0.94, transition: { duration: 0.16 } }}
            transition={{ type: 'spring', stiffness: 420, damping: 30 }}
            className={`toast toast-${toast.type}`}
            data-testid="toast"
            role={toast.type === 'error' ? 'alert' : 'status'}
          >
            <span className="toast-icon">
              {toast.type === 'success' ? <SavedTick size={18} label="" /> : toast.type === 'error' ? <XCircle size={16} /> : <Info size={16} />}
            </span>
            <span className="toast-message">{toast.message}</span>
            <button
              className="toast-close"
              aria-label="Dismiss notification"
              onClick={() => setToasts((t) => t.filter((x) => x.id !== toast.id))}
            >
              ×
            </button>
            <span className="toast-life" aria-hidden="true" />
          </motion.div>
        ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
