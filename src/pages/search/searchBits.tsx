import { Lock } from 'lucide-react';
import type { Role } from '../../types';
import { moneyShort } from '../quotes/quoteLogic';
import { agoText, highlightParts, hitActions, TYPE_META, type SearchHit, type SearchType } from './searchLogic';

/** Text with the searched words marked. */
export function Marked({ text, words }: { text: string; words: string }) {
  return (
    <>
      {highlightParts(text, words).map((part, i) => (part.hit ? <mark key={i}>{part.text}</mark> : <span key={i}>{part.text}</span>))}
    </>
  );
}

/** The coloured square with a type's icon. */
export function TypeIcon({ type, size = 15, big = false }: { type: SearchType; size?: number; big?: boolean }) {
  const meta = TYPE_META[type];
  const Icon = meta.icon;
  return (
    <span className={`sx-tyi${big ? ' big' : ''}`} style={{ ['--c' as string]: meta.hue }} aria-hidden="true">
      <Icon size={size} />
    </span>
  );
}

export const LockNote = ({ children }: { children: React.ReactNode }) => (
  <span className="sx-lock"><Lock size={12} aria-hidden="true" /> {children}</span>
);

interface PreviewProps {
  hit: SearchHit | null;
  words: string;
  role: Role | undefined;
  /** Shown when nothing is picked. */
  idle: string;
  onOpen: (hit: SearchHit) => void;
  onAction: (to: string) => void;
}

/** The quick search's right-hand pane: the picked record, without leaving the page you are on. */
export function SearchPreview({ hit, words, role, idle, onOpen, onAction }: PreviewProps) {
  if (!hit) {
    return (
      <aside className="sx-prev" aria-label="Preview">
        <span className="sx-lab">Preview</span>
        <p className="sx-muted">{idle}</p>
      </aside>
    );
  }
  const meta = TYPE_META[hit.type];
  const facts: [string, string][] = [
    ...(hit.ref ? [['Reference', hit.ref] as [string, string]] : []),
    ...(hit.status ? [['Status', hit.status] as [string, string]] : []),
    ...(hit.ownerId ? [['Owner', hit.ownerName || '—'] as [string, string]] : []),
    ...(hit.amount ? [[hit.type === 'account' ? 'Revenue' : hit.type === 'campaign' ? 'Budget' : hit.type === 'product' ? 'Price' : 'Value', moneyShort(hit.amount)] as [string, string]] : []),
    [hit.type === 'meeting' ? 'When' : hit.type === 'task' ? 'Due' : 'Updated', agoText(hit.at)],
    ...hit.fields.filter(([label, value]) => value && !(hit.sub && value === hit.sub)).slice(0, 6),
  ];
  const hidden = role === 'viewer' && ['lead', 'contact', 'account'].includes(hit.type);
  return (
    <aside className="sx-prev" aria-label="Preview" data-testid="search-preview" key={`${hit.type}-${hit.id}`}>
      <div className="sx-prev-head"><TypeIcon type={hit.type} size={16} /><span className="sx-lab">{meta.one}</span></div>
      <h3><Marked text={hit.title} words={words} /></h3>
      {hit.sub && <div className="sx-muted">{hit.sub}</div>}
      <dl className="sx-kv">
        {facts.map(([k, v]) => (
          <div key={k}><dt>{k}</dt><dd><Marked text={v} words={words} /></dd></div>
        ))}
      </dl>
      {hidden && <LockNote>Email and phone are hidden for viewers.</LockNote>}
      <div className="sx-acts">
        <button type="button" className="btn btn-primary" onMouseDown={(e) => e.preventDefault()} onClick={() => onOpen(hit)} data-testid="search-preview-open">Open</button>
        {hitActions(hit, role).map((a) => (
          <button key={a.label} type="button" className="btn" onMouseDown={(e) => e.preventDefault()} onClick={() => onAction(a.to)}>{a.label}</button>
        ))}
      </div>
    </aside>
  );
}
