import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ChevronLeft, ChevronRight, Clock, Trash2, X } from 'lucide-react';
import { Lead } from '../types';
import { formatCurrency, formatDate } from '../utils';

interface LeadTriageModeProps {
  leads: Lead[];
  ownerName: (id: string) => string;
  onQualify: (lead: Lead) => void;
  onDisqualify: (lead: Lead) => void;
  onExit: () => void;
}

/**
 * Full-screen, keyboard-driven one-record-at-a-time review queue.
 * Arrow keys move through the queue; Q/D qualify or disqualify; Escape exits.
 * Additive — the standard table view is untouched and remains the default.
 */
export function LeadTriageMode({ leads, ownerName, onQualify, onDisqualify, onExit }: LeadTriageModeProps) {
  const [index, setIndex] = useState(0);
  const lead = leads[index];

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onExit();
      else if (e.key === 'ArrowRight') setIndex((i) => Math.min(i + 1, leads.length - 1));
      else if (e.key === 'ArrowLeft') setIndex((i) => Math.max(i - 1, 0));
      else if ((e.key === 'q' || e.key === 'Q') && lead) onQualify(lead);
      else if ((e.key === 'd' || e.key === 'D') && lead) onDisqualify(lead);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [lead, leads.length, onQualify, onDisqualify, onExit]);

  if (!lead) {
    return (
      <div className="card" data-testid="lead-triage-mode" style={{ textAlign: 'center', padding: 60 }}>
        <p>No leads left in this queue.</p>
        <button className="btn" onClick={onExit}>
          Back to table
        </button>
      </div>
    );
  }

  return (
    <div data-testid="lead-triage-mode">
      <div className="page-header">
        <h1>Triage — {index + 1} of {leads.length}</h1>
        <div className="page-actions">
          <button className="icon-btn" aria-label="Exit triage mode" onClick={onExit}>
            <X size={18} />
          </button>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 640, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <h2 style={{ margin: 0 }}>
              <Link to={`/leads/${lead.id}`}>{lead.name}</Link>
            </h2>
            <p className="muted" style={{ margin: '4px 0 0' }}>{lead.company}</p>
          </div>
          <span className={`pill status-${lead.status.toLowerCase()}`}>{lead.status}</span>
        </div>

        <dl className="detail-list">
          <dt>Email</dt>
          <dd>{lead.email}</dd>
          <dt>Phone</dt>
          <dd>{lead.phone || '—'}</dd>
          <dt>Source</dt>
          <dd>{lead.source}</dd>
          <dt>Owner</dt>
          <dd>{ownerName(lead.ownerId)}</dd>
          <dt>Estimated value</dt>
          <dd>{formatCurrency(lead.value)}</dd>
          <dt>Created</dt>
          <dd>{formatDate(lead.createdAt)}</dd>
        </dl>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 20, flexWrap: 'wrap' }}>
          <button className="btn" disabled={index === 0} onClick={() => setIndex((i) => i - 1)}>
            <ChevronLeft size={14} /> Back
          </button>
          <button className="btn btn-danger" data-testid="triage-disqualify" onClick={() => onDisqualify(lead)}>
            <Trash2 size={14} /> Disqualify (D)
          </button>
          <button
            className="btn"
            data-testid="triage-skip"
            onClick={() => setIndex((i) => Math.min(i + 1, leads.length - 1))}
          >
            <Clock size={14} /> Skip
          </button>
          <button className="btn btn-apply" data-testid="triage-qualify" onClick={() => onQualify(lead)}>
            <Check size={14} /> Qualify (Q)
          </button>
          <button className="btn" disabled={index >= leads.length - 1} onClick={() => setIndex((i) => i + 1)}>
            Next <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
