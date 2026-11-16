import { ArrowDown, ArrowUp, ChevronsUpDown, Mail, MoreHorizontal, Phone } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { Lead } from '../../types';
import { formatCurrency, formatDate, initials } from '../../utils';
import { emptyStateKind, getAriaSort, shouldOpenRowOnKeyDown } from './leadsGuards';

export type SortKey = 'name' | 'company' | 'status' | 'source' | 'value' | 'createdAt';
export type SortDir = 'asc' | 'desc';

/** Columns shown to every role. Email and phone are not columns: writers get call and email buttons on the row. */
export const LEAD_COLUMNS = 8;

interface Props {
  rows: Lead[];
  totalLeads: number;
  selected: string[];
  allPageSelected: boolean;
  sortKey: SortKey;
  sortDir: SortDir;
  ownerName: (id: string) => string;
  onToggleSort: (key: SortKey) => void;
  onToggleSelectAll: () => void;
  onToggleSelect: (id: string) => void;
  onOpen: (lead: Lead) => void;
  onContextMenu: (e: React.MouseEvent, lead: Lead) => void;
  onRowMenu: (e: React.MouseEvent<HTMLElement>, lead: Lead) => void;
}

export function LeadsTable({
  rows,
  totalLeads,
  selected,
  allPageSelected,
  sortKey,
  sortDir,
  ownerName,
  onToggleSort,
  onToggleSelectAll,
  onToggleSelect,
  onOpen,
  onContextMenu,
  onRowMenu,
}: Props) {
  const { user } = useAuth();
  const showContactDetails = user?.role === 'admin' || user?.role === 'rep';

  const sortable = (key: SortKey, label: string, extra = '') => (
    <th
      scope="col"
      role="columnheader"
      tabIndex={0}
      aria-sort={getAriaSort(key, sortKey, sortDir)}
      onClick={() => onToggleSort(key)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onToggleSort(key);
        }
      }}
      className={`sortable${extra}`}
    >
      <span className="lead-sort">
        {label}
        {sortKey !== key ? <ChevronsUpDown size={13} aria-hidden="true" /> : sortDir === 'asc' ? <ArrowUp size={13} aria-hidden="true" /> : <ArrowDown size={13} aria-hidden="true" />}
      </span>
    </th>
  );

  return (
    <>
    <div className="table-wrap lead-table">
      <table className="table">
        <thead>
          <tr>
            <th className="checkbox-cell">
              <input type="checkbox" aria-label="Select all" checked={allPageSelected} onChange={onToggleSelectAll} />
            </th>
            {sortable('name', 'Lead')}
            {sortable('status', 'Status')}
            {sortable('source', 'Source')}
            <th scope="col">Owner</th>
            {sortable('value', 'Value', ' num')}
            {sortable('createdAt', 'Created')}
            <th scope="col"><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={LEAD_COLUMNS} className="empty-cell">
                {emptyStateKind(totalLeads) === 'no-leads' ? 'No leads yet.' : 'No leads match the current filters.'}
              </td>
            </tr>
          )}
          {rows.map((lead, index) => (
            <tr
              key={lead.id}
              className={`row-clickable${selected.includes(lead.id) ? ' row-selected' : ''}`}
              style={{ animationDelay: `${Math.min(index, 12) * 28}ms` }}
              tabIndex={0}
              onClick={() => onOpen(lead)}
              onKeyDown={(e) => {
                if (shouldOpenRowOnKeyDown(e.key, e.target === e.currentTarget)) {
                  e.preventDefault();
                  onOpen(lead);
                }
              }}
              onContextMenu={(e) => onContextMenu(e, lead)}
            >
              <td className="checkbox-cell" onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  aria-label={`Select ${lead.name}`}
                  checked={selected.includes(lead.id)}
                  onChange={() => onToggleSelect(lead.id)}
                />
              </td>
              <td title={lead.name}>
                <span className="lead-who">
                  <span className="lead-avatar" aria-hidden="true">{initials(lead.name)}</span>
                  <span className="lead-who-text">
                    <b>{lead.name}</b>
                    <small>{lead.company || '—'}</small>
                  </span>
                </span>
              </td>
              <td>
                <span data-testid="lead-status" className={`pill status-${lead.status.toLowerCase()}`}>{lead.status}</span>
              </td>
              <td>{lead.source}</td>
              <td>
                <span className="lead-owner">
                  <span className="lead-avatar small" aria-hidden="true">{initials(ownerName(lead.ownerId))}</span>
                  {ownerName(lead.ownerId)}
                </span>
              </td>
              <td className="num">{formatCurrency(lead.value)}</td>
              <td>{formatDate(lead.createdAt)}</td>
              <td onClick={(e) => e.stopPropagation()}>
                <span className="lead-row-actions">
                  {showContactDetails && lead.phone && (
                    <a className="lead-quick" href={`tel:${lead.phone}`} aria-label={`Call ${lead.name}`} title={lead.phone}>
                      <Phone size={15} />
                    </a>
                  )}
                  {showContactDetails && (
                    <a className="lead-quick" href={`mailto:${lead.email}`} aria-label={`Email ${lead.name}`} title={lead.email}>
                      <Mail size={15} />
                    </a>
                  )}
                  <button
                    type="button"
                    className="lead-more"
                    aria-label={`Actions for ${lead.name}`}
                    aria-haspopup="menu"
                    onClick={(e) => onRowMenu(e, lead)}
                  >
                    <MoreHorizontal size={18} />
                  </button>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    <ul className="lead-cards" aria-label="Leads">
      {rows.map((lead) => (
        <li key={lead.id} className={`lead-card${selected.includes(lead.id) ? ' row-selected' : ''}`}>
          <label className="lead-card-check">
            <input
              type="checkbox"
              aria-label={`Select ${lead.name}`}
              checked={selected.includes(lead.id)}
              onChange={() => onToggleSelect(lead.id)}
            />
          </label>
          <button type="button" className="lead-card-top" onClick={() => onOpen(lead)}>
            <b>{lead.name}</b>
            <span className="muted">{lead.company}</span>
          </button>
          <button
            type="button"
            className="lead-more"
            aria-label={`Actions for ${lead.name}`}
            aria-haspopup="menu"
            onClick={(e) => onRowMenu(e, lead)}
          >
            <MoreHorizontal size={18} />
          </button>
          <div className="lead-card-meta">
            <span data-testid="lead-status" className={`pill status-${lead.status.toLowerCase()}`}>{lead.status}</span>
            <span>{ownerName(lead.ownerId)}</span>
            <b>{formatCurrency(lead.value)}</b>
          </div>
        </li>
      ))}
    </ul>
    </>
  );
}
