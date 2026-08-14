import { useState } from 'react';
import { Modal } from './Modal';
import { Select, Option } from './Select';

export interface MassUpdateField {
  key: string;
  label: string;
  options: Option[];
}

interface MassUpdateModalProps {
  fields: MassUpdateField[];
  count: number;
  onClose: () => void;
  onApply: (fieldKey: string, value: string) => void | Promise<void>;
}

/** Bulk-edit wizard: pick a field, set a value, apply to the current selection. */
export function MassUpdateModal({ fields, count, onClose, onApply }: MassUpdateModalProps) {
  const [fieldKey, setFieldKey] = useState(fields[0]?.key ?? '');
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const field = fields.find((f) => f.key === fieldKey);

  const apply = async () => {
    if (!field || !value) return;
    setBusy(true);
    await onApply(fieldKey, value);
    setBusy(false);
    onClose();
  };

  return (
    <Modal
      title={`Mass update ${count} record(s)`}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-apply" disabled={!value || busy} onClick={apply}>
            {busy ? 'Applying…' : 'Apply to all'}
          </button>
        </>
      }
    >
      <div className="field">
        <span className="field-label">Field</span>
        <Select
          value={fieldKey}
          options={fields.map((f) => ({ value: f.key, label: f.label }))}
          onChange={(v) => {
            setFieldKey(v);
            setValue('');
          }}
        />
      </div>
      {field && (
        <div className="field">
          <span className="field-label">New value</span>
          <Select value={value} options={field.options} onChange={setValue} placeholder="Select a value…" />
        </div>
      )}
    </Modal>
  );
}
