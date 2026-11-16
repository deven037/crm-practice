import { ReactNode, useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

/** The class that gives a status its colour (styles/leads.css). A status a bank added itself takes the bank's colour. */
export const statusClass = (status: string) => `status-${status.toLowerCase().replace(/\s+/g, '-')}`;

/** Statuses whose name contains what was typed. */
export function filterStatuses(options: string[], query: string): string[] {
  const q = query.trim().toLowerCase();
  return q ? options.filter((option) => option.toLowerCase().includes(q)) : options;
}

/** Adds the status, or removes it when it is already chosen. */
export function toggleStatus(selected: string[], status: string): string[] {
  return selected.includes(status) ? selected.filter((value) => value !== status) : [...selected, status];
}

interface Props {
  options: string[];
  selected: string[];
  /** Several can be chosen (a filter) or exactly one (a record's status). */
  multi?: boolean;
  onPick: (status: string) => void;
  label: string;
  className?: string;
  testId?: string;
  children: ReactNode;
}

/**
 * A searchable list of statuses that opens under its button. Banks add their own
 * status codes without limit, so statuses are never laid out as a row of buttons.
 */
export function StatusPicker({ options, selected, multi = false, onPick, label, className, testId, children }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrap = useRef<HTMLSpanElement>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    input.current?.focus();
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

  const shown = filterStatuses(options, query);

  return (
    <span className="status-picker" ref={wrap}>
      <button
        type="button"
        className={className}
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        data-testid={testId}
        onClick={() => {
          setQuery('');
          setOpen((o) => !o);
        }}
      >
        {children}
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      {open && (
        <div className="status-picker-pop" data-testid={testId ? `${testId}-list` : undefined}>
          <input
            ref={input}
            className="status-picker-find"
            aria-label="Find a status"
            placeholder="Find a status"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div role="listbox" aria-label={label} aria-multiselectable={multi || undefined}>
            {shown.length === 0 && <div className="status-picker-none">No status matches.</div>}
            {shown.map((status) => {
              const chosen = selected.includes(status);
              return (
                <button
                  type="button"
                  key={status}
                  role="option"
                  aria-selected={chosen}
                  className="status-picker-option"
                  onClick={() => {
                    onPick(status);
                    if (!multi) setOpen(false);
                  }}
                >
                  <span className={`status-dot ${statusClass(status)}`} aria-hidden="true" />
                  {status}
                  {chosen && <Check size={15} className="status-picker-tick" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </span>
  );
}
