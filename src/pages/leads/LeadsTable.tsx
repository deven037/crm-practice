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
  onConvert: (lead: Lead) => void;
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
  onConvert,
}: Props) {
  const handleSortKeyDown = (e: React.KeyboardEvent, key: SortKey) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onToggleSort(key);
    }
  };

  return (
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
            <th scope="col">Email</th>
            <th scope="col">Phone</th>
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
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={11} className="empty-cell">
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
              <td>{lead.name}</td>
              <td>{lead.company}</td>
              <td>{lead.email}</td>
              <td>{lead.phone}</td>
              <td>
                <span className={`pill status-${lead.status.toLowerCase()}`}>{lead.status}</span>
              </td>
              <td>{lead.source}</td>
              <td>{ownerName(lead.ownerId)}</td>
              <td className="num">{formatCurrency(lead.value)}</td>
              <td>{formatDate(lead.createdAt)}</td>
              <td onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  className="btn btn-small"
                  onClick={() => onConvert(lead)}
                >
                  Convert
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
