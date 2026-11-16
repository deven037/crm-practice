/**
 * One bank colour drives the whole theme. From that single colour this file works out
 * everything that must stay readable: the text colour that sits on a bank-coloured
 * fill, and a version of the colour that is safe to use as text or a focus ring on
 * the light page and on the dark page. styles/v3.css derives the rest with color-mix.
 */

export const HARBOR_COLOR = '#1d3a6e';

const LIGHT_SURFACE = '#ffffff';
const DARK_SURFACE = '#171c28';
const DARK_INK = '#14110a';
const WHITE = '#ffffff';

type Rgb = [number, number, number];

export function parseHex(value: string | null | undefined): Rgb | null {
  const match = /^#?([0-9a-f]{6})$/i.exec((value ?? '').trim());
  if (!match) return null;
  const n = parseInt(match[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function toHex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`;
}

function luminance([r, g, b]: Rgb): number {
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG contrast ratio between two colours, 1 to 21. */
export function contrast(a: string, b: string): number {
  const la = luminance(parseHex(a) ?? [0, 0, 0]);
  const lb = luminance(parseHex(b) ?? [0, 0, 0]);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function mix(from: Rgb, to: Rgb, amount: number): Rgb {
  return [0, 1, 2].map((i) => from[i] + (to[i] - from[i]) * amount) as Rgb;
}

/** Moves a colour toward black or white, in small steps, until it reads at 4.5:1 on the surface. */
function readableOn(color: Rgb, surface: string, toward: Rgb): string {
  for (let step = 0; step <= 20; step++) {
    const candidate = toHex(mix(color, toward, step / 20));
    if (contrast(candidate, surface) >= 4.5) return candidate;
  }
  return toHex(toward);
}

export interface BankTheme {
  /** The bank's colour, for fills. */
  primary: string;
  /** Text on a bank-coloured fill. */
  on: string;
  /** The bank colour as text, links and focus rings on the light page. */
  inkLight: string;
  /** The same on the dark page. */
  inkDark: string;
}

export function bankTheme(color: string | null | undefined): BankTheme {
  const rgb = parseHex(color) ?? parseHex(HARBOR_COLOR)!;
  const primary = toHex(rgb);
  return {
    primary,
    on: contrast(primary, WHITE) >= contrast(primary, DARK_INK) ? WHITE : DARK_INK,
    inkLight: readableOn(rgb, LIGHT_SURFACE, [0, 0, 0]),
    inkDark: readableOn(rgb, DARK_SURFACE, [255, 255, 255]),
  };
}

const KEY = 'crm.bankColor';

/** Paints the app in a bank's colour. Pass null to go back to the Harbor default. */
export function applyBankTheme(color: string | null | undefined, remember = true): BankTheme {
  const theme = bankTheme(color);
  if (typeof document === 'undefined') return theme;
  const style = document.documentElement.style;
  style.setProperty('--bank-primary', theme.primary);
  style.setProperty('--bank-on', theme.on);
  style.setProperty('--bank-ink-light', theme.inkLight);
  style.setProperty('--bank-ink-dark', theme.inkDark);
  if (remember) {
    try {
      if (parseHex(color)) localStorage.setItem(KEY, theme.primary);
      else localStorage.removeItem(KEY);
    } catch {
      /* private mode: the colour simply is not remembered */
    }
  }
  return theme;
}

/** The colour this device last showed, so a reload does not flash the default first. */
export function rememberedBankColor(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}
