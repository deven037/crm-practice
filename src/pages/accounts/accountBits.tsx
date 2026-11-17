import { CSSProperties, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAllSync } from '../../data/store';
import { Account, Deal } from '../../types';

const INDUSTRY_HUES: Record<string, string> = {
  technology: '#2f6fe0',
  finance: '#17936a',
  healthcare: '#0f97a8',
  retail: '#d1478d',
  manufacturing: '#c98a12',
  energy: '#d9642b',
  logistics: '#6d4fd6',
  media: '#7c869b',
};
const SPARE_HUES = ['#2f6fe0', '#c98a12', '#17936a', '#6d4fd6', '#0f97a8', '#d1478d'];

/** One steady colour per industry, so an organisation looks the same on the map, the ledger and its own page. */
export function industryHue(industry: string): string {
  const key = industry.trim().toLowerCase();
  if (INDUSTRY_HUES[key]) return INDUSTRY_HUES[key];
  let n = 0;
  for (const ch of key) n = (n * 31 + ch.charCodeAt(0)) >>> 0;
  return SPARE_HUES[n % SPARE_HUES.length];
}

export const industryStyle = (industry: string) => ({ '--h': industryHue(industry) }) as CSSProperties;

export function accountInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.length ? parts.slice(0, 2).map((p) => p[0]).join('').toUpperCase() : '+';
}

/** Money in a few characters ($96M, $1.5M, $650K) for tiles and figures. The full amount stays on the detail rows. */
export function shortMoney(amount: number): string {
  const n = Math.max(0, amount || 0);
  const trim = (v: number) => v.toFixed(1).replace(/\.0$/, '');
  if (n >= 1e9) return `$${trim(n / 1e9)}B`;
  if (n >= 1e6) return `$${trim(n / 1e6)}M`;
  if (n >= 1e3) return `$${Math.round(n / 1e3)}K`;
  return `$${Math.round(n)}`;
}

export const isOpenDeal = (deal: Pick<Deal, 'stage'>) => !deal.stage.startsWith('Closed');

export function openPipeline(deals: Pick<Deal, 'stage' | 'amount'>[]): number {
  return deals.filter(isOpenDeal).reduce((sum, d) => sum + d.amount, 0);
}

export type AccountSort = 'revenue' | 'employees' | 'name';

export function sortAccounts(accounts: Account[], sort: AccountSort): Account[] {
  return [...accounts].sort((a, b) =>
    sort === 'name' ? a.name.localeCompare(b.name) : sort === 'employees' ? b.employees - a.employees : b.revenue - a.revenue);
}

export function filterByIndustry(accounts: Account[], industries: string[]): Account[] {
  return industries.length ? accounts.filter((a) => industries.includes(a.industry)) : accounts;
}

export interface MapRect<T> {
  item: T;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Squarified treemap: fills a width x height box with one rectangle per item, area in proportion to its value. */
export function squarify<T>(items: { item: T; value: number }[], width: number, height: number): MapRect<T>[] {
  const total = items.reduce((sum, i) => sum + i.value, 0);
  if (!items.length || total <= 0 || width <= 0 || height <= 0) return [];
  const scale = (width * height) / total;
  const rest = items.map((i) => ({ item: i.item, area: i.value * scale }));
  const out: MapRect<T>[] = [];
  let x = 0, y = 0, w = width, h = height;
  const sum = (row: { area: number }[]) => row.reduce((t, i) => t + i.area, 0);
  const worst = (row: { area: number }[], side: number) => {
    const s = sum(row);
    const areas = row.map((i) => i.area);
    return Math.max((side * side * Math.max(...areas)) / (s * s), (s * s) / (side * side * Math.min(...areas)));
  };
  while (rest.length) {
    const side = Math.min(w, h);
    const row = [rest.shift()!];
    while (rest.length && worst([...row, rest[0]], side) <= worst(row, side)) row.push(rest.shift()!);
    const s = sum(row);
    if (w >= h) {
      const colW = s / h;
      let cy = y;
      for (const i of row) { const ch = i.area / colW; out.push({ item: i.item, x, y: cy, w: colW, h: ch }); cy += ch; }
      x += colW; w -= colW;
    } else {
      const rowH = s / w;
      let cx = x;
      for (const i of row) { const cw = i.area / rowH; out.push({ item: i.item, x: cx, y, w: cw, h: rowH }); cx += cw; }
      y += rowH; h -= rowH;
    }
  }
  return out;
}

/** Largest first. Very small accounts get a floor (5% of the largest) so their tile stays big enough to click. */
export function mapValues(accounts: Account[]): { item: Account; value: number }[] {
  const sorted = [...accounts].sort((a, b) => b.revenue - a.revenue);
  const max = Math.max(0, sorted[0]?.revenue ?? 0);
  return sorted.map((item) => ({ item, value: max > 0 ? Math.max(item.revenue, max * 0.05) : 1 }));
}

export function tileSize(w: number, h: number): 'big' | 'mid' | 'tiny' {
  return w >= 132 && h >= 96 ? 'big' : w >= 84 && h >= 50 ? 'mid' : 'tiny';
}

export function AccountCrest({ account, size }: { account: Pick<Account, 'name' | 'industry'>; size?: 'large' }) {
  return (
    <span className={`acct-crest${size ? ` ${size}` : ''}`} style={industryStyle(account.industry)} aria-hidden="true">
      {accountInitials(account.name)}
    </span>
  );
}

/** True while the screen is phone-sized; the map gives way to the ledger there. */
export function useNarrow(query = '(max-width: 760px)'): boolean {
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.(query).matches);
  useEffect(() => {
    const mq = window.matchMedia?.(query);
    if (!mq) return;
    const onChange = () => setNarrow(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);
  return narrow;
}

const MAP_HEIGHT = 430;

/** The portfolio map: every account is a tile sized by annual revenue and coloured by industry. */
export function PortfolioMap({ accounts, deals }: { accounts: Account[]; deals: Deal[] }) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    setWidth(el.clientWidth);
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const rects = squarify(mapValues(accounts), width, MAP_HEIGHT);
  const industries = [...new Set(accounts.map((a) => a.industry))];

  return (
    <div className="card acct-mapcard" data-testid="accounts-map">
      <div className="acct-map" ref={box} style={{ height: MAP_HEIGHT }}>
        {rects.map((r, index) => {
          const a = r.item;
          const size = tileSize(r.w, r.h);
          const open = deals.filter((d) => d.accountId === a.id && isOpenDeal(d));
          return (
            <Link
              key={a.id}
              to={`/accounts/${a.id}`}
              className={`acct-tile ${size}`}
              data-testid="account-tile"
              title={`${a.name} · ${a.industry} · ${shortMoney(a.revenue)}`}
              aria-label={`${a.name}, ${a.industry}, annual revenue ${shortMoney(a.revenue)}`}
              style={{ ...industryStyle(a.industry), left: r.x + 3, top: r.y + 3, width: Math.max(0, r.w - 6), height: Math.max(0, r.h - 6), animationDelay: `${Math.min(index, 16) * 35}ms` }}
            >
              {size === 'tiny' ? accountInitials(a.name) : (
                <>
                  {size === 'big' && <small>{a.industry}</small>}
                  <b>{a.name}</b>
                  <span className="acct-tile-rev">{shortMoney(a.revenue)}</span>
                  {size === 'big' && (
                    <span className="acct-tile-meta">
                      {open.length ? `${open.length} open ${open.length === 1 ? 'deal' : 'deals'} · ${shortMoney(openPipeline(open))}` : 'No open deals'}
                    </span>
                  )}
                </>
              )}
            </Link>
          );
        })}
      </div>
      <div className="acct-legend">
        {industries.map((name) => (
          <span key={name}><i style={{ background: industryHue(name) }} />{name}</span>
        ))}
        <em>Tile size shows annual revenue</em>
      </div>
    </div>
  );
}

/** A figure that counts up once when the page opens. People who ask for less motion get the final number straight away. */
export function CountUp({ value, format }: { value: number; format: (n: number) => string }) {
  const still = typeof window === 'undefined' || !window.requestAnimationFrame || !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const [progress, setProgress] = useState(still ? 1 : 0);

  useEffect(() => {
    if (still) return;
    let frame = 0;
    const start = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / 650);
      setProgress(1 - Math.pow(1 - p, 3));
      if (p < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [still, value]);

  return <>{format(value * progress)}</>;
}

/** Beside the form: the tile this account will get on the portfolio map, updating as the form is filled in. */
export function AccountTilePreview({ id, name, industry, revenue, owner }: { id: string; name: string; industry: string; revenue: number; owner: string }) {
  const others = getAllSync<Account>('accounts').filter((a) => a.id !== id).reduce((sum, a) => sum + Math.max(0, a.revenue || 0), 0);
  const amount = Math.max(0, revenue || 0);
  const share = amount > 0 ? (amount / (others + amount)) * 100 : 0;
  return (
    <aside className="card acct-preview" aria-label="Preview on the portfolio map" data-testid="account-preview">
      <span className="acct-eyebrow">On the portfolio map</span>
      <div className="acct-tile big" style={industryStyle(industry)}>
        <small>{industry || 'Industry'}</small>
        <b>{name.trim() || 'Account name'}</b>
        <span className="acct-tile-rev">{shortMoney(amount)}</span>
        <span className="acct-tile-meta">{owner ? `Owner: ${owner}` : 'No owner yet'}</span>
      </div>
      <span className="muted">
        {amount > 0 ? `About ${share < 1 ? 'under 1' : Math.round(share)}% of the portfolio by revenue` : 'Add annual revenue to size the tile'}
      </span>
      <div className="acct-share"><i style={{ width: `${share}%` }} /></div>
    </aside>
  );
}
