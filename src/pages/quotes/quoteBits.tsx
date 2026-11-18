import { CSSProperties, ReactNode, useState } from 'react';
import { Check, Search, XCircle } from 'lucide-react';
import { Account, ChargeType, Deal, Quote, QuoteSettings, User } from '../../types';
import { bankProfileSync } from '../../data/store';
import { Modal } from '../../components/Modal';
import { classNames } from '../../utils';
import { CHARGE_LABEL } from '../products/productLogic';
import { lineAmount, quoteSums } from './quoteMath';
import { dayText, isDecided, money, moneyShort, quoteHue, rejectReasons, statusTotals, Validity } from './quoteLogic';

export function QuoteStatusPill({ status }: { status: string }) {
  return <span className="pq-pill" style={{ '--c': quoteHue(status) } as CSSProperties} data-testid="quote-status"><i />{status}</span>;
}

/** A ring that empties as a sent quote's validity runs out. */
export function ValidityRing({ v }: { v: Validity }) {
  const hue = v.tone === 'late' ? '#d33a3a' : v.tone === 'soon' ? '#d9a21a' : '#1f9d63';
  return (
    <svg className="pq-vring" viewBox="0 0 36 36" aria-hidden="true">
      <circle className="bg" cx="18" cy="18" r="15.9" />
      <circle className="fg" cx="18" cy="18" r="15.9" pathLength={100} style={{ '--c': hue, '--v': v.share * 100 } as CSSProperties} />
    </svg>
  );
}

/** The paper thumbnail in quote rows: a line per quote line, and a stamp ring once decided. */
export function QuoteThumb({ quote }: { quote: Quote }) {
  return (
    <span className="pq-thumb" aria-hidden="true">
      {quote.lineItems.slice(0, 5).map((l) => <i key={l.id} />)}
      {isDecided(quote) && <em style={{ '--c': quoteHue(quote.status) } as CSSProperties} />}
    </span>
  );
}

export interface PaperProps {
  quote: Pick<Quote, 'quoteNumber' | 'lineItems' | 'validUntil' | 'createdAt' | 'status' | 'decidedAt'>;
  account?: Account;
  contactName?: string;
  deal?: Deal;
  owner?: User;
  settings: QuoteSettings;
  /** In the builder: an empty table shows where to drop products, and the newest line flashes. */
  live?: boolean;
  freshLine?: string | null;
  /** Plays the stamp landing (right after the status changed). */
  stampFresh?: boolean;
  footer?: ReactNode;
}

/** The quote as the document the customer gets: letterhead, lines, totals per charge type, terms and signature. */
export function QuotePaper({ quote, account, contactName, deal, owner, settings, live, freshLine, stampFresh }: PaperProps) {
  const bank = bankProfileSync();
  const sums = quoteSums(quote.lineItems, settings.taxPercent);
  const groups = (Object.keys(sums.byUnit) as ChargeType[]).filter((u) => sums.byUnit[u] > 0);
  const decided = isDecided(quote) && !live;
  return (
    <article className={classNames('pq-paper', decided && stampFresh && 'thud')} aria-label="Quote document" data-testid="quote-paper">
      <div className="pq-lh">
        {bank?.logoUrl ? <img className="pq-blogo img" src={bank.logoUrl} alt="" /> : <i className="pq-blogo">{(bank?.name ?? 'H').charAt(0)}</i>}
        <div className="pq-bn"><b>{bank?.name ?? 'Harbor Bank'}</b><small>Quotation</small></div>
        <div className="pq-qn"><span className="pq-lab">Quotation</span><b>{quote.quoteNumber}</b><small>{dayText(quote.createdAt)}</small></div>
      </div>
      <div className="pq-bill">
        <div><span className="pq-lab">Prepared for</span>{account ? <><b>{account.name}</b><small>{contactName ? `Attn. ${contactName}` : account.industry}</small></> : <b className="pq-ph0">Choose an account</b>}</div>
        <div><span className="pq-lab">Valid until</span><b>{dayText(quote.validUntil)}</b></div>
        <div><span className="pq-lab">For</span><b>{deal?.name ?? '—'}</b></div>
      </div>
      <div className="pq-lines-wrap">
        <table className="pq-lines">
          <thead><tr><th>#</th><th>Product</th><th className="r">Qty</th><th className="r">Price</th><th className="r dc">Disc.</th><th className="r">Amount</th></tr></thead>
          <tbody>
            {quote.lineItems.map((l, i) => (
              <tr key={l.id} className={classNames(live && freshLine === l.id && 'new')}>
                <td>{i + 1}</td>
                <td><b>{l.productName}</b><small>{[l.sku, l.unit ?? 'One-time'].filter(Boolean).join(' · ')}</small></td>
                <td className="r">{l.quantity}</td>
                <td className="r">{money(l.unitPrice)}</td>
                <td className={classNames('r dc', l.discountPct > settings.discountLimit && 'dover')}>{l.discountPct ? `${l.discountPct}%` : '—'}</td>
                <td className="r">{money(lineAmount(l))}</td>
              </tr>
            ))}
            {quote.lineItems.length === 0 && live && <tr className="pq-ph-row"><td colSpan={6}>Drag products here, or click them on the left</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="pq-ptot">
        <div className="pq-terms"><b>Terms</b>Prices are before {settings.taxName}, which is added at {settings.taxPercent}%. Monthly and yearly charges continue until the service is closed. This quote is valid until {dayText(quote.validUntil)}.</div>
        <dl>
          {sums.discount > 0 && <div><dt>Discount</dt><dd>−{money(sums.discount)}</dd></div>}
          <div><dt>{settings.taxName} {settings.taxPercent}%</dt><dd>{money(sums.tax)}</dd></div>
          {groups.map((u) => <div key={u}><dt>{CHARGE_LABEL[u]}</dt><dd>{money(sums.byUnit[u])}</dd></div>)}
          <div className="fy"><dt>First-year value</dt><dd data-testid="quote-first-year">{money(sums.firstYear)}</dd></div>
        </dl>
      </div>
      <div className="pq-sig">
        <div>{owner && <><span className="pq-hand">{owner.name}</span>{owner.name}</>}</div>
        <div>Page 1 of 1</div>
      </div>
      {decided && (
        <div className={classNames('pq-stamp', stampFresh && 'fresh')} style={{ '--sc': quoteHue(quote.status) } as CSSProperties} data-testid="quote-stamp">
          {quote.status.toUpperCase()}<small>{dayText(quote.decidedAt).toUpperCase()}</small>
        </div>
      )}
    </article>
  );
}

/**
 * Where the value of all quotes stands: one band from "all quotes" fanning out to each status, as thick as the
 * first-year value in it. Every status (band or legend row) is a filter.
 */
export function QuoteFan({ quotes, settings, picked, onPick }: { quotes: Quote[]; settings: QuoteSettings; picked: string; onPick: (status: string) => void }) {
  const rows = statusTotals(quotes, settings);
  const total = rows.reduce((t, r) => t + r.value, 0);
  const H = 200;
  const gap = 14;
  const top = 14;
  const L = 196;
  const R = 420;
  const sc = H / (total || 1);
  const mid = (L + R) / 2;
  let ly = top;
  let ry = top;
  let lastLab = -99;
  const bands = rows.map((r, i) => {
    const h = Math.max(3, r.value * sc);
    const d = `M${L},${ly} C${mid},${ly} ${mid},${ry} ${R},${ry} V${ry + h} C${mid},${ry + h} ${mid},${ly + h} ${L},${ly + h} Z`;
    lastLab = Math.max(ry + h / 2, lastLab + 36);
    const band = { ...r, d, ry, h, lab: lastLab, delay: i * 90 };
    ly += h;
    ry += h + gap;
    return band;
  });
  const vb = Math.max(ry, top + H + 4, lastLab + 24) + 6;
  return (
    <>
      <svg className={classNames('pq-fan', picked !== 'all' && rows.some((r) => r.status === picked) && 'picked')} viewBox={`0 0 600 ${vb}`} role="group" aria-label="Quotes by status">
        <rect x={L - 8} y={top} width={8} height={ly - top} rx={3} fill="var(--bank-primary)" />
        <text x={L - 20} y={top + (ly - top) / 2 - 8} textAnchor="end">All {quotes.length} quotes</text>
        <text className="big" x={L - 20} y={top + (ly - top) / 2 + 18} textAnchor="end">{moneyShort(total)}</text>
        {bands.map((b) => (
          <g key={b.status} className={classNames('rib', picked === b.status && 'on')} style={{ '--c': quoteHue(b.status) } as CSSProperties}
            role="button" tabIndex={0} aria-pressed={picked === b.status} aria-label={`${b.status}: ${b.count} quotes`} data-testid={`quote-fan-${b.status.toLowerCase()}`}
            onClick={() => onPick(b.status)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(b.status); } }}>
            <path d={b.d} style={{ animationDelay: `${b.delay}ms` }} />
            <rect x={R} y={b.ry} width={8} height={b.h} rx={3} />
            <text className="nmv" x={R + 18} y={b.lab - 2}>{b.status}</text>
            <text x={R + 18} y={b.lab + 14}>{b.count} · {moneyShort(b.value)}</text>
          </g>
        ))}
      </svg>
      <div className="pq-fanbar">
        <div className="bar" aria-hidden="true">{rows.map((r) => <i key={r.status} style={{ '--c': quoteHue(r.status), flexGrow: r.value || 0.01 } as CSSProperties} />)}</div>
        <div className="leg">
          {rows.map((r) => (
            <button key={r.status} type="button" className={classNames(picked === r.status && 'on')} aria-pressed={picked === r.status} onClick={() => onPick(r.status)}>
              <i style={{ '--c': quoteHue(r.status) } as CSSProperties} />{r.status}<span>{r.count} · {moneyShort(r.value)}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

/** Asks why the customer said no; the reasons are the bank's own list. */
export function RejectDialog({ who, onCancel, onConfirm }: { who: string; onCancel: () => void; onConfirm: (reason: string, note: string) => void }) {
  const [reason, setReason] = useState('');
  const [query, setQuery] = useState('');
  const [note, setNote] = useState('');
  const q = query.trim().toLowerCase();
  const reasons = rejectReasons().filter((r) => !q || r.toLowerCase().includes(q));
  return (
    <Modal
      title={`Why did ${who} say no?`}
      onClose={onCancel}
      footer={
        <>
          <button className="btn" onClick={onCancel}>Cancel</button>
          <button className="btn btn-danger" data-testid="confirm-reject-btn" disabled={!reason} onClick={() => onConfirm(reason, note.trim())}>
            <XCircle size={15} aria-hidden="true" /> Mark rejected
          </button>
        </>
      }
    >
      <div className="deal-lost">
        <label className="deal-find">
          <Search size={16} aria-hidden="true" />
          <input aria-label="Find a reason" placeholder="Find a reason" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <div className="deal-reasons" role="radiogroup" aria-label="Reason">
          {reasons.length === 0 && <div className="muted deal-picker-none">No reason matches.</div>}
          {reasons.map((r) => (
            <button type="button" key={r} role="radio" aria-checked={reason === r} className="deal-reason" onClick={() => setReason(r)}>
              {r}
              {reason === r && <Check size={15} aria-hidden="true" />}
            </button>
          ))}
        </div>
        <textarea className="input pq-note" aria-label="Note" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
    </Modal>
  );
}
