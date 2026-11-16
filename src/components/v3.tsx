import { ReactNode, useEffect, useRef, useState } from 'react';

/** True when the person's device asks for less motion. Every animation here checks it. */
export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

// ---------- where the last click was, so dialogs can grow out of it ----------

let lastPointer: { x: number; y: number; at: number } | null = null;
if (typeof document !== 'undefined') {
  document.addEventListener(
    'pointerdown',
    (e) => {
      lastPointer = { x: e.clientX, y: e.clientY, at: Date.now() };
    },
    true
  );
}

/**
 * CSS variables that place a dialog's transform-origin at the click that opened it.
 * Opened from the keyboard (or long after a click), it grows from its own centre.
 */
export function originFromLastClick(box: DOMRect | undefined, now = Date.now(), pointer = lastPointer): Record<string, string> {
  if (!box || !pointer || now - pointer.at > 800) return {};
  return { '--from-x': `${Math.round(pointer.x - box.left)}px`, '--from-y': `${Math.round(pointer.y - box.top)}px` };
}

/** The part of an element this file needs; lets the function below be tested without a browser. */
export interface ClosingTarget {
  classList: { add: (name: string) => void; contains: (name: string) => boolean };
  isConnected: boolean;
}

/**
 * Lets a dialog or panel play its closing animation before it is removed: marks the
 * overlay as closing (styles/v3.css plays the exit), then calls onClose. With no
 * overlay, or for people who asked for less motion, it closes at once. A second
 * request while closing is ignored, and nothing is called if the overlay has
 * already gone.
 */
export function closeWithExit(overlay: ClosingTarget | null | undefined, onClose: () => void, ms = 150, reduced = prefersReducedMotion()): void {
  if (!overlay || !overlay.classList || reduced) {
    onClose();
    return;
  }
  if (overlay.classList.contains('v3-closing')) return;
  overlay.classList.add('v3-closing');
  setTimeout(() => {
    if (overlay.isConnected) onClose();
  }, ms);
}

// ---------- numbers that count up ----------

/** The value to show at a point in a count-up, eased so it slows as it arrives. */
export function countAt(from: number, to: number, progress: number): number {
  const p = Math.min(Math.max(progress, 0), 1);
  const eased = 1 - (1 - p) ** 3;
  return from + (to - from) * eased;
}

/** A figure that counts up to its value when it first appears and whenever it changes. */
export function AnimatedNumber({ value, format = (n) => Math.round(n).toLocaleString(), duration = 700 }: {
  value: number;
  format?: (n: number) => string;
  duration?: number;
}) {
  const [shown, setShown] = useState(() => (prefersReducedMotion() ? value : 0));
  const from = useRef(shown);
  useEffect(() => {
    if (prefersReducedMotion() || typeof requestAnimationFrame === 'undefined') {
      setShown(value);
      from.current = value;
      return;
    }
    const start = performance.now();
    const origin = from.current;
    let frame = 0;
    const step = (now: number) => {
      const progress = (now - start) / duration;
      const next = countAt(origin, value, progress);
      from.current = next;
      setShown(next);
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);
  // Screen readers get the final value straight away, not every frame.
  return (
    <span aria-label={format(value)}>
      <span aria-hidden="true">{format(shown)}</span>
    </span>
  );
}

// ---------- small feedback ----------

/** A tick that draws itself: shown when something has been saved. */
export function SavedTick({ size = 20, label = 'Saved' }: { size?: number; label?: string }) {
  return (
    <svg className="v3-tick" width={size} height={size} viewBox="0 0 24 24" role="img" aria-label={label}>
      <circle cx="12" cy="12" r="10" />
      <path d="M7.5 12.5l3 3 6-6.5" />
    </svg>
  );
}

/** An empty page: a small picture in the bank's colour, a title, a line of help and an action. */
export function EmptyState({ title, children, action, testId }: { title: string; children?: ReactNode; action?: ReactNode; testId?: string }) {
  return (
    <div className="v3-empty" data-testid={testId}>
      <svg viewBox="0 0 132 96" aria-hidden="true">
        <rect className="art-fill" x="14" y="22" width="104" height="62" rx="12" />
        <path className="art-line" d="M30 44h44M30 56h60M30 68h32" />
        <g className="art-float">
          <circle className="art-accent" cx="100" cy="24" r="14" />
          <path d="M94 24h12M100 18v12" stroke="var(--bank-on)" strokeWidth="2.4" strokeLinecap="round" />
        </g>
      </svg>
      <strong>{title}</strong>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

/** Shown while a page's data loads: grey shapes where the content will be. */
export function PageSkeleton({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="v3-skeleton-page" role="status" aria-label={label}>
      <div className="skeleton sk-title" />
      <div className="sk-tiles">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton sk-tile" />
        ))}
      </div>
      <div className="skeleton sk-block" />
    </div>
  );
}
