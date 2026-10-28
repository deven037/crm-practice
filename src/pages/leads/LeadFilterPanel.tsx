import { LEAD_SOURCES } from '../../types';
import { MultiSelect, Select } from '../../components/Select';

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
      <div className="field">
        <span className="field-label">Status</span>
        <MultiSelect
          values={statusFilter}
          options={statusOptions.map((s) => ({ value: s, label: s }))}
          onChange={onStatusChange}
          placeholder="Any status"
        />
      </div>
      <div className="field">
        <span className="field-label">Source</span>
        <Select
          value={sourceFilter}
          options={[{ value: '', label: 'Any source' }, ...LEAD_SOURCES.map((s) => ({ value: s, label: s }))]}
          onChange={onSourceChange}
        />
      </div>
      <div className="field">
        <span className="field-label">Owner</span>
        <Select value={ownerFilter} options={[{ value: '', label: 'Any owner' }, ...ownerOptions]} onChange={onOwnerChange} />
      </div>
      <button className="link-btn" onClick={onClear}>
        Clear filters
      </button>
    </div>
  );
}
