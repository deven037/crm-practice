import { MoreHorizontal } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { Lead } from '../../types';
import { formatCurrency, formatDate } from '../../utils';
import { emptyStateKind, getAriaSort, shouldOpenRowOnKeyDown } from './leadsGuards';

export type SortKey = 'name' | 'company' | 'status' | 'source' | 'value' | 'createdAt';
export type SortDir = 'asc' | 'desc';

interface Props {
  rows: Lead[];
  totalLeads: number;
  selected: string[];
  allPageSelected: boolean;
  sortKey: SortKey;
  sortDir: SortDir;
  ownerName: (id: string) => string;
  sortIndicator: (key: SortKey) => string;
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
  sortIndicator,
  onToggleSort,
  onToggleSelectAll,
  onToggleSelect,
  onOpen,
  onContextMenu,
  onRowMenu,
}: Props) {
  const { user } = useAuth();
  const showContactDetails = user?.role === 'admin' || user?.role === 'rep';

  const handleSortKeyDown = (e: React.KeyboardEvent, key: SortKey) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onToggleSort(key);
    }
  };

  return (
    <>
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th className="checkbox-cell">
              <input type="checkbox" aria-label="Select all" checked={allPageSelected} onChange={onToggleSelectAll} />
            </th>
            <th
              scope="col"
              role="columnheader"
              tabIndex={0}
              aria-sort={getAriaSort('name', sortKey, sortDir)}
              onClick={() => onToggleSort('name')}
              onKeyDown={(e) => handleSortKeyDown(e, 'name')}
              className="sortable"
            >
              Name{sortIndicator('name')}
            </th>
            <th
              scope="col"
              role="columnheader"
              tabIndex={0}
              aria-sort={getAriaSort('company', sortKey, sortDir)}
              onClick={() => onToggleSort('company')}
              onKeyDown={(e) => handleSortKeyDown(e, 'company')}
              className="sortable"
            >
              Company{sortIndicator('company')}
            </th>
            {showContactDetails && <th scope="col">Email</th>}
            {showContactDetails && <th scope="col">Phone</th>}
            <th
              scope="col"
              role="columnheader"
              tabIndex={0}
              aria-sort={getAriaSort('status', sortKey, sortDir)}
              onClick={() => onToggleSort('status')}
              onKeyDown={(e) => handleSortKeyDown(e, 'status')}
              className="sortable"
            >
              Status{sortIndicator('status')}
            </th>
            <th
              scope="col"
              role="columnheader"
              tabIndex={0}
              aria-sort={getAriaSort('source', sortKey, sortDir)}
              onClick={() => onToggleSort('source')}
              onKeyDown={(e) => handleSortKeyDown(e, 'source')}
              className="sortable"
            >
              Source{sortIndicator('source')}
            </th>
            <th scope="col">Owner</th>
            <th
              scope="col"
              role="columnheader"
              tabIndex={0}
              aria-sort={getAriaSort('value', sortKey, sortDir)}
              onClick={() => onToggleSort('value')}
              onKeyDown={(e) => handleSortKeyDown(e, 'value')}
              className="sortable num"
            >
              Value{sortIndicator('value')}
            </th>
            <th
              scope="col"
              role="columnheader"
              tabIndex={0}
              aria-sort={getAriaSort('createdAt', sortKey, sortDir)}
              onClick={() => onToggleSort('createdAt')}
              onKeyDown={(e) => handleSortKeyDown(e, 'createdAt')}
              className="sortable"
            >
              Created{sortIndicator('createdAt')}
            </th>
            <th scope="col"><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={showContactDetails ? 11 : 9} className="empty-cell">
                {emptyStateKind(totalLeads) === 'no-leads' ? 'No leads yet.' : 'No leads match the current filters.'}
              </td>
            </tr>
          )}
          {rows.map((lead) => (
            <tr
              key={lead.id}
              className={`row-clickable${selected.includes(lead.id) ? ' row-selected' : ''}`}
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
              <td title={lead.name}>{lead.name}</td>
              <td title={lead.company}>{lead.company}</td>
              {showContactDetails && <td title={lead.email}>{lead.email}</td>}
              {showContactDetails && <td>{lead.phone}</td>}
              <td>
                <span data-testid="lead-status" className={`pill status-${lead.status.toLowerCase()}`}>{lead.status}</span>
              </td>
              <td>{lead.source}</td>
              <td>{ownerName(lead.ownerId)}</td>
              <td className="num">{formatCurrency(lead.value)}</td>
              <td>{formatDate(lead.createdAt)}</td>
              <td onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  className="lead-more"
                  aria-label={`Actions for ${lead.name}`}
                  aria-haspopup="menu"
                  onClick={(e) => onRowMenu(e, lead)}
                >
                  <MoreHorizontal size={18} />
                </button>
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
