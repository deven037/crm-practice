import { LEAD_SOURCES } from '../../types';
import { Select } from '../../components/Select';

interface Props {
  statusFilter: string[];
  statusOptions: string[];
  sourceFilter: string;
  ownerFilter: string;
  ownerOptions: { value: string; label: string }[];
  onStatusChange: (v: string[]) => void;
  onSourceChange: (v: string) => void;
  onOwnerChange: (v: string) => void;
  onClear: () => void;
}

export function LeadFilterPanel({
  statusFilter,
  statusOptions,
  sourceFilter,
  ownerFilter,
  ownerOptions,
  onStatusChange,
  onSourceChange,
  onOwnerChange,
  onClear,
}: Props) {
  return (
    <div className="filter-panel" data-testid="filter-panel">
      <fieldset className="lead-status-filters">
        <legend className="field-label">Status</legend>
        <div className="lead-filter-chips">
          {statusOptions.map((status) => (
            <label key={status} className="lead-filter-chip">
              <input
                type="checkbox"
                checked={statusFilter.includes(status)}
                onChange={() => onStatusChange(statusFilter.includes(status)
                  ? statusFilter.filter((value) => value !== status)
                  : [...statusFilter, status])}
              />
              {status}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="field">
        <label className="field-label" htmlFor="lead-filter-source">Source</label>
        <Select
          id="lead-filter-source"
          value={sourceFilter}
          options={[{ value: '', label: 'Any source' }, ...LEAD_SOURCES.map((s) => ({ value: s, label: s }))]}
          onChange={onSourceChange}
        />
      </div>
      <div className="field">
        <label className="field-label" htmlFor="lead-filter-owner">Owner</label>
        <Select id="lead-filter-owner" value={ownerFilter} options={[{ value: '', label: 'Any owner' }, ...ownerOptions]} onChange={onOwnerChange} />
      </div>
      <button className="link-btn" onClick={onClear}>
        Clear filters
      </button>
    </div>
  );
}
