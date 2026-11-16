import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ChevronLeft, X } from 'lucide-react';
import { Lead } from '../types';
import { formatCurrency, formatDate, initials } from '../utils';
import { prefersReducedMotion } from './v3';

interface LeadTriageModeProps {
  leads: Lead[];
  ownerName: (id: string) => string;
  onQualify: (lead: Lead) => void;
  onDisqualify: (lead: Lead) => void;
  onExit: () => void;
}

type Leaving = 'right' | 'left' | 'up';

/** How far through the queue the person is, as a whole percentage for the progress bar. */
export function triageProgress(index: number, total: number): number {
  if (total <= 0) return 100;
  return Math.round((Math.min(Math.max(index, 0), total) / total) * 100);
}

function TriageCard({ lead, ownerName, depth, leaving }: { lead: Lead; ownerName: (id: string) => string; depth: number; leaving?: Leaving | null }) {
  return (
    <div className={`triage-card depth-${depth}${leaving ? ` leaving-${leaving}` : ''}`} aria-hidden={depth > 0 || undefined}>
      <div className="lead-who">
        <span className="lead-avatar large" aria-hidden="true">{initials(lead.name)}</span>
        <span className="lead-who-text">
          <b>{depth === 0 ? <Link to={`/leads/${lead.id}`}>{lead.name}</Link> : lead.name}</b>
          <small>{lead.company || '—'}</small>
        </span>
      </div>
      <div className="triage-card-line">
        <span className={`pill status-${lead.status.toLowerCase()}`}>{lead.status}</span>
        <span className="muted">{lead.source} · created {formatDate(lead.createdAt)}</span>
      </div>
      <div>
        <span className="lead-eyebrow">Estimated value</span>
        <div className="lead-big">{formatCurrency(lead.value)}</div>
      </div>
      <dl className="lead-facts">
        <div><dt>Email</dt><dd>{lead.email}</dd></div>
        <div><dt>Phone</dt><dd>{lead.phone || '—'}</dd></div>
        <div><dt>Owner</dt><dd>{ownerName(lead.ownerId)}</dd></div>
      </dl>
    </div>
  );
}

/**
 * One lead at a time, as a stack of cards. Q qualifies, D disqualifies, the right arrow
 * skips, the left arrow goes back and Escape leaves. The card slides away before the next
 * one comes up; the table view is untouched and stays the default.
 */
export function LeadTriageMode({ leads, ownerName, onQualify, onDisqualify, onExit }: LeadTriageModeProps) {
  const [index, setIndex] = useState(0);
  const [leaving, setLeaving] = useState<Leaving | null>(null);
  const busy = useRef(false);
  const lead = leads[index];

  const act = (direction: Leaving, after?: (lead: Lead) => void) => {
    if (!lead || busy.current) return;
    const done = () => {
      busy.current = false;
      setLeaving(null);
      after?.(lead);
      setIndex((i) => i + 1);
    };
    if (prefersReducedMotion()) {
      done();
      return;
    }
    busy.current = true;
    setLeaving(direction);
    setTimeout(done, 280);
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'Escape') onExit();
      else if (e.key === 'ArrowRight') act('up');
      else if (e.key === 'ArrowLeft') setIndex((i) => Math.max(i - 1, 0));
      else if (e.key === 'q' || e.key === 'Q') act('right', onQualify);
      else if (e.key === 'd' || e.key === 'D') act('left', onDisqualify);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead, leads.length, onQualify, onDisqualify, onExit]);

  return (
    <div className="triage" data-testid="lead-triage-mode">
      <div className="triage-top">
        <h2>Triage</h2>
        <span className="muted triage-count">{lead ? `${index + 1} of ${leads.length}` : `${leads.length} of ${leads.length}`}</span>
        <button className="icon-btn" aria-label="Exit triage mode" onClick={onExit}>
          <X size={18} />
        </button>
      </div>
      <div className="triage-bar" role="progressbar" aria-label="Queue progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={triageProgress(index, leads.length)}>
        <span style={{ width: `${triageProgress(index, leads.length)}%` }} />
      </div>

      {!lead ? (
        <div className="card triage-done">
          <span className="lead-okmark"><Check size={26} /></span>
          <h3>No leads left in this queue.</h3>
          <p className="muted">New leads show here as they arrive.</p>
          <button className="btn" onClick={onExit}>
            Back to table
          </button>
        </div>
      ) : (
        <>
          <div className="triage-stack">
            {leads.slice(index, index + 3).map((item, depth) => (
              <TriageCard key={item.id} lead={item} ownerName={ownerName} depth={depth} leaving={depth === 0 ? leaving : null} />
            )).reverse()}
          </div>
          <div className="triage-actions">
            <button className="btn triage-no" data-testid="triage-disqualify" onClick={() => act('left', onDisqualify)}>
              Disqualify <small>D</small>
            </button>
            <button className="btn" data-testid="triage-skip" onClick={() => act('up')}>
              Skip <small>→</small>
            </button>
            <button className="btn triage-yes" data-testid="triage-qualify" onClick={() => act('right', onQualify)}>
              Qualify <small>Q</small>
            </button>
          </div>
          <button className="link-btn triage-back" disabled={index === 0} onClick={() => setIndex((i) => Math.max(i - 1, 0))}>
            <ChevronLeft size={14} /> Previous lead
          </button>
        </>
      )}
    </div>
  );
}
