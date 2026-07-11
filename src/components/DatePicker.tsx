import { useEffect, useRef, useState } from 'react';
import { formatDate } from '../utils';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

interface DatePickerProps {
  value: string | null;
  onChange: (iso: string) => void;
  testId?: string;
}

/** Fully custom calendar popup — no native date input, so tests must drive the widget. */
export function DatePicker({ value, onChange, testId }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const initial = value ? new Date(value) : new Date();
  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth());
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const selected = value ? new Date(value) : null;
  const today = new Date();

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else setViewMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else setViewMonth((m) => m + 1);
  };

  const isSameDay = (a: Date, y: number, m: number, d: number) =>
    a.getFullYear() === y && a.getMonth() === m && a.getDate() === d;

  return (
    <div className="datepicker" ref={ref}>
      <input
        type="text"
        readOnly
        className="input datepicker-input"
        data-testid={testId}
        placeholder="Pick a date"
        value={value ? formatDate(value) : ''}
        onClick={() => setOpen((o) => !o)}
      />
      {open && (
        <div className="datepicker-popup">
          <div className="datepicker-nav">
            <button type="button" aria-label="Previous month" onClick={prevMonth}>‹</button>
            <span className="datepicker-title">
              {MONTHS[viewMonth]} {viewYear}
            </span>
            <button type="button" aria-label="Next month" onClick={nextMonth}>›</button>
          </div>
          <div className="datepicker-grid">
            {WEEKDAYS.map((w) => (
              <span key={w} className="datepicker-weekday">
                {w}
              </span>
            ))}
            {Array.from({ length: firstDay }).map((_, i) => (
              <span key={`pad-${i}`} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const isSelected = selected !== null && isSameDay(selected, viewYear, viewMonth, day);
              const isToday = isSameDay(today, viewYear, viewMonth, day);
              return (
                <button
                  key={day}
                  type="button"
                  className={`datepicker-day${isSelected ? ' selected' : ''}${isToday ? ' today' : ''}`}
                  onClick={() => {
                    onChange(new Date(viewYear, viewMonth, day, 12).toISOString());
                    setOpen(false);
                  }}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
