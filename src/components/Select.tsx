import { useEffect, useMemo, useRef, useState } from 'react';

export interface Option {
  value: string;
  label: string;
}

function useOutsideClose(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);
  return ref;
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
      )}
    </div>
  );
}
