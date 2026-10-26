import { Lead } from '../../types';
import { formatCurrency, formatDate } from '../../utils';

export type SortKey = 'name' | 'company' | 'status' | 'source' | 'value' | 'createdAt';

interface Props {
  rows: Lead[];
  selected: string[];
  allPageSelected: boolean;
  ownerName: (id: string) => string;
  sortIndicator: (key: SortKey) => string;
  onToggleSort: (key: SortKey) => void;
  onToggleSelectAll: () => void;
  onToggleSelect: (id: string) => void;
  onOpen: (lead: Lead) => void;
  onContextMenu: (e: React.MouseEvent, lead: Lead) => void;
}

export function LeadsTable({
  rows,
  selected,
  allPageSelected,
  ownerName,
  sortIndicator,
  onToggleSort,
  onToggleSelectAll,
  onToggleSelect,
  onOpen,
  onContextMenu,
}: Props) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th className="checkbox-cell">
              <input type="checkbox" aria-label="Select all" checked={allPageSelected} onChange={onToggleSelectAll} />
            </th>
            <th onClick={() => onToggleSort('name')} className="sortable">Name{sortIndicator('name')}</th>
            <th onClick={() => onToggleSort('company')} className="sortable">Company{sortIndicator('company')}</th>
            <th>Email</th>
            <th>Phone</th>
            <th onClick={() => onToggleSort('status')} className="sortable">Status{sortIndicator('status')}</th>
            <th onClick={() => onToggleSort('source')} className="sortable">Source{sortIndicator('source')}</th>
            <th>Owner</th>
            <th onClick={() => onToggleSort('value')} className="sortable num">Value{sortIndicator('value')}</th>
            <th onClick={() => onToggleSort('createdAt')} className="sortable">Created{sortIndicator('createdAt')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={10} className="empty-cell">
                No leads match the current filters.
              </td>
            </tr>
          )}
          {rows.map((lead) => (
            <tr
              key={lead.id}
              className={`row-clickable${selected.includes(lead.id) ? ' row-selected' : ''}`}
              onClick={() => onOpen(lead)}
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
