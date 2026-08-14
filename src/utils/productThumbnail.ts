const PALETTE: [string, string][] = [
  ['#2563eb', '#7c3aed'],
  ['#d6336c', '#f97316'],
  ['#059669', '#0ea5e9'],
  ['#b5d334', '#059669'],
  ['#7c3aed', '#d6336c'],
  ['#0ea5e9', '#2563eb'],
  ['#f59e0b', '#d6336c'],
];

function hash(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) >>> 0;
  return h;
}

/** Deterministic gradient per product (hashed from id/sku) — stable across reloads since no real product photos exist. */
export function productThumbnailGradient(seed: string): string {
  const [from, to] = PALETTE[hash(seed) % PALETTE.length];
  return `linear-gradient(135deg, ${from}, ${to})`;
}
