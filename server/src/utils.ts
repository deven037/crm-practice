// Server-side port of ../../src/utils.ts's autoCloseDate/round2 helpers — kept in sync manually.
import { Deal, DealStage } from './types.js';

/**
 * Stamps closeDate to now when a deal newly transitions into a closed stage
 * (from a non-closed previous stage) — mirrors the client-side fix so the
 * won-revenue reporting stays correct regardless of whether the change came
 * from the UI or the API.
 */
export function autoCloseDate(previousStage: DealStage, deal: Deal): Deal {
  const wasClosed = previousStage.startsWith('Closed');
  const isClosed = deal.stage.startsWith('Closed');
  return !wasClosed && isClosed ? { ...deal, closeDate: new Date().toISOString() } : deal;
}

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
