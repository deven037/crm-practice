// Copied from ../../src/utils.ts — keep in sync manually; see mobile/README.md
// downloadCsv (Blob/DOM-specific) and classNames (web className-joining idiom, not used by
// React Native's StyleSheet-based styling) are intentionally omitted — see mobile/README.md.
// CSV export on mobile uses expo-sharing's native share sheet instead (see src/utils/csvShare.ts).

import { Deal, DealStage } from './types';

/**
 * Stamps closeDate to now when a deal newly transitions into a closed stage
 * (from a non-closed previous stage) — without this, the dashboard's won-revenue
 * chart (which buckets by closeDate's month) never reflects a deal closed today,
 * since new/open deals default to a closeDate weeks in the future.
 */
export function autoCloseDate(previousStage: DealStage, deal: Deal): Deal {
  const wasClosed = previousStage.startsWith('Closed');
  const isClosed = deal.stage.startsWith('Closed');
  return !wasClosed && isClosed ? { ...deal, closeDate: new Date().toISOString() } : deal;
}

export function formatCurrency(amount: number, cents = false): string {
  return (
    '$' +
    amount.toLocaleString('en-US', cents ? { minimumFractionDigits: 2, maximumFractionDigits: 2 } : undefined)
  );
}

/** Rounds to the nearest cent — used to avoid compounding float error in quote line-item math. */
export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function slugify(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(iso);
}

export function isOverdue(iso: string): boolean {
  return new Date(iso).getTime() < Date.now();
}

export function initials(name: string): string {
  return name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}
