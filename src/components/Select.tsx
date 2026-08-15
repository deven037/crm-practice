import { CSSProperties, ReactNode, RefObject, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export interface Option {
  value: string;
  label: string;
}

function useOutsideClose(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Element;
      // The dropdown panel itself renders in a `.select-portal` under document.body (see
      // PortalMenu below), outside this ref's DOM subtree — without this check, clicking
      // an option would register as an "outside" click and close the menu before the
      // option's own onClick fires.
      if (ref.current && !ref.current.contains(target) && !target.closest?.('.select-portal')) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);
  return ref;
}

/**
 * Renders dropdown content into document.body at a fixed position computed from the
 * trigger's bounding rect, so it's never clipped by an ancestor with overflow:auto/hidden
 * (e.g. a Select inside a `.table-wrap` table cell). Closes on scroll/resize rather than
 * tracking live position — dropdowns are short-lived, so this keeps the fix simple.
 */
const MENU_MAX_HEIGHT = 240;

function PortalMenu({ anchorRef, onClose, children }: { anchorRef: RefObject<HTMLElement>; onClose: () => void; children: ReactNode }) {
  const [rect, setRect] = useState<{ top?: number; bottom?: number; left: number; width: number; maxHeight: number } | null>(null);

  useEffect(() => {
    const el = anchorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    // Flip upward when there isn't enough room below for the menu at its usual max-height —
    // otherwise, for a trigger low on the page, the menu (fixed-positioned, so never clipped by
    // an ancestor's overflow) still ends up clipped by the viewport itself, with no way to scroll
    // the rest of it into view (e.g. "Layout" as the last option in a long field list).
    const spaceBelow = window.innerHeight - r.bottom - 4;
    const spaceAbove = r.top - 4;
    const openUpward = spaceBelow < MENU_MAX_HEIGHT && spaceAbove > spaceBelow;
    setRect(
      openUpward
        ? { bottom: window.innerHeight - r.top + 4, left: r.left, width: r.width, maxHeight: Math.min(MENU_MAX_HEIGHT, spaceAbove) }
        : { top: r.bottom + 4, left: r.left, width: r.width, maxHeight: Math.min(MENU_MAX_HEIGHT, spaceBelow) }
    );
    // Scroll events don't bubble but still fire on `window` during the capture phase for any
    // descendant target — including the menu's own scrollable list. Without this check, a user
    // scrolling the option list itself (e.g. to reach "Layout" at the bottom) would immediately
    // close the menu instead of scrolling it.
    const close = (e: Event) => {
      if ((e.target as Element | null)?.closest?.('.select-portal')) return;
      onClose();
    };
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!rect) return null;
  // `--menu-max-height` is consumed by `.select-menu`/`.select-menu-searchable ul` in styles.css
  // instead of their own hardcoded max-height, so the actual scrollable list (not just this
  // positioning wrapper) is capped to whatever room is genuinely available in the viewport.
  return createPortal(
    <div
      className="select-portal"
      style={
        {
          position: 'fixed',
          top: rect.top,
          bottom: rect.bottom,
          left: rect.left,
          width: rect.width,
          zIndex: 1050,
          '--menu-max-height': `${rect.maxHeight}px`,
        } as CSSProperties
      }
    >
      {children}
    </div>,
    document.body
  );
}

interface SelectProps {
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  placeholder?: string;
  testId?: string;
  disabled?: boolean;
}

/** Custom (non-native) single select — practices listbox-style locators. */
export function Select({ value, options, onChange, placeholder = 'Select…', testId, disabled }: SelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useOutsideClose(() => setOpen(false));
  const selected = options.find((o) => o.value === value);

  return (
    <div className="select" ref={ref}>
      <button
        type="button"
        className="select-trigger"
        data-testid={testId}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={selected ? '' : 'select-placeholder'}>{selected ? selected.label : placeholder}</span>
        <span className="caret" aria-hidden="true">▾</span>
      </button>
      {open && (
        <PortalMenu anchorRef={ref} onClose={() => setOpen(false)}>
          <ul className="select-menu" role="listbox">
            {options.map((option) => (
              <li
                key={option.value}
                role="option"
                aria-selected={option.value === value}
                className={option.value === value ? 'selected' : ''}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                {option.label}
              </li>
            ))}
          </ul>
        </PortalMenu>
      )}
    </div>
  );
}

interface SearchableSelectProps extends SelectProps {
  emptyText?: string;
}

/** Custom select with a filter input inside the dropdown. */
export function SearchableSelect({ value, options, onChange, placeholder = 'Select…', testId, disabled, emptyText = 'No matches found' }: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useOutsideClose(() => setOpen(false));
  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(
    () => options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase())),
    [options, query]
  );

  return (
    <div className="select" ref={ref}>
      <button
        type="button"
        className="select-trigger"
        data-testid={testId}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          setOpen((o) => !o);
          setQuery('');
        }}
      >
        <span className={selected ? '' : 'select-placeholder'}>{selected ? selected.label : placeholder}</span>
        <span className="caret" aria-hidden="true">▾</span>
      </button>
      {open && (
        <PortalMenu anchorRef={ref} onClose={() => setOpen(false)}>
          <div className="select-menu select-menu-searchable">
            <input
              className="select-search"
              placeholder="Type to filter…"
              value={query}
              autoFocus
              onChange={(e) => setQuery(e.target.value)}
            />
            <ul role="listbox">
              {filtered.length === 0 && <li className="select-empty">{emptyText}</li>}
              {filtered.map((option) => (
                <li
                  key={option.value}
                  role="option"
                  aria-selected={option.value === value}
                  className={option.value === value ? 'selected' : ''}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                >
                  {option.label}
                </li>
              ))}
            </ul>
          </div>
        </PortalMenu>
      )}
    </div>
  );
}

interface MultiSelectProps {
  values: string[];
  options: Option[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  testId?: string;
}

/** Custom multi-select with checkbox options and removable tag chips. */
export function MultiSelect({ values, options, onChange, placeholder = 'Select…', testId }: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useOutsideClose(() => setOpen(false));

  const toggle = (v: string) => {
    onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);
  };

  return (
    <div className="select" ref={ref}>
      <button
        type="button"
        className="select-trigger multi"
        data-testid={testId}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {values.length === 0 ? (
          <span className="select-placeholder">{placeholder}</span>
        ) : (
          <span className="chip-row">
            {values.map((v) => (
              <span key={v} className="chip">
                {options.find((o) => o.value === v)?.label ?? v}
                <span
                  className="chip-remove"
                  role="button"
                  aria-label={`Remove ${v}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggle(v);
                  }}
                >
                  ×
                </span>
              </span>
            ))}
          </span>
        )}
        <span className="caret" aria-hidden="true">▾</span>
      </button>
      {open && (
        <PortalMenu anchorRef={ref} onClose={() => setOpen(false)}>
          <ul className="select-menu" role="listbox" aria-multiselectable="true">
            {options.map((option) => (
              <li
                key={option.value}
                role="option"
                aria-selected={values.includes(option.value)}
                onClick={() => toggle(option.value)}
              >
                <input type="checkbox" readOnly checked={values.includes(option.value)} tabIndex={-1} /> {option.label}
              </li>
            ))}
          </ul>
        </PortalMenu>
      )}
    </div>
  );
}
