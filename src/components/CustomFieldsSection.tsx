import { Fragment } from 'react';
import { getAllSync } from '../data/store';
import { CustomFieldDef, CustomFieldModule, LayoutDef, LayoutTarget } from '../types';
import { Select } from './Select';
import { DatePicker } from './DatePicker';
import { formatDate } from '../utils';

export type CustomFieldValues = Record<string, string | number | boolean | null>;

function getModuleFields(module: CustomFieldModule): CustomFieldDef[] {
  return getAllSync<CustomFieldDef>('customFieldDefs').filter((d) => d.module === module);
}

/**
 * Fields to render for a given module+target, in saved layout order. Falls back to
 * "every custom field for this module, creation order" when no layout has been saved
 * yet, so a newly-defined field is visible somewhere before an admin explicitly
 * designs a layout. Defensively drops any field id that no longer resolves to a def.
 */
function getLayoutFields(module: CustomFieldModule, target: LayoutTarget): CustomFieldDef[] {
  const defs = getModuleFields(module);
  const layout = getAllSync<LayoutDef>('layouts').find((l) => l.module === module && l.target === target);
  if (!layout) return defs;
  const byId = new Map(defs.map((d) => [d.id, d]));
  return layout.fieldIds.map((id) => byId.get(id)).filter((d): d is CustomFieldDef => Boolean(d));
}

export function validateCustomFields(
  module: CustomFieldModule,
  target: LayoutTarget,
  values: CustomFieldValues
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of getLayoutFields(module, target)) {
    if (!field.required) continue;
    const v = values[field.key];
    const empty = v === null || v === undefined || v === '';
    if (empty) errors[field.key] = `${field.label} is required.`;
  }
  return errors;
}

export function CustomFieldsSection({
  module,
  target,
  mode,
  values,
  onChange,
  errors,
}: {
  module: CustomFieldModule;
  target: LayoutTarget;
  mode: 'edit' | 'view';
  values: CustomFieldValues;
  onChange?: (key: string, value: string | number | boolean | null) => void;
  errors?: Record<string, string>;
}) {
  const fields = getLayoutFields(module, target);
  if (fields.length === 0) return null;

  // Renders bare dt/dd or field blocks — no card/heading of its own — so callers embed
  // this directly inside their existing <dl className="detail-list"> (view) or
  // <div className="form-grid"> (edit), merging custom fields into the same form/detail
  // surface as standard fields rather than a visually separate section.
  if (mode === 'view') {
    return (
      <>
        {fields.map((f) => {
          const v = values[f.key];
          let display: string;
          if (v === null || v === undefined || v === '') display = '—';
          else if (f.type === 'checkbox') display = v ? 'Yes' : 'No';
          else if (f.type === 'date') display = formatDate(String(v));
          else display = String(v);
          return (
            <Fragment key={f.id}>
              <dt>{f.label}</dt>
              <dd>{display}</dd>
            </Fragment>
          );
        })}
      </>
    );
  }

  return (
    <>
      {fields.map((f) => {
        const raw = values[f.key];
        return (
          <div className="field" key={f.id}>
            <span className="field-label">
              {f.label}
              {f.required ? ' *' : ''}
            </span>
            {f.type === 'text' && (
              <input
                className="input"
                value={typeof raw === 'string' ? raw : ''}
                onChange={(e) => onChange?.(f.key, e.target.value)}
              />
            )}
            {f.type === 'number' && (
              <input
                className="input"
                type="number"
                value={typeof raw === 'number' ? raw : ''}
                onChange={(e) => onChange?.(f.key, e.target.value === '' ? null : Number(e.target.value))}
              />
            )}
            {f.type === 'date' && (
              <DatePicker value={typeof raw === 'string' ? raw : null} onChange={(iso) => onChange?.(f.key, iso)} />
            )}
            {f.type === 'dropdown' && (
              <Select
                value={typeof raw === 'string' ? raw : ''}
                options={(f.options ?? []).map((o) => ({ value: o, label: o }))}
                onChange={(v) => onChange?.(f.key, v)}
              />
            )}
            {f.type === 'checkbox' && (
              <label className="switch-row">
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={Boolean(raw)}
                    onChange={(e) => onChange?.(f.key, e.target.checked)}
                  />
                  <span className="switch-slider" />
                </label>
              </label>
            )}
            {errors?.[f.key] && <span className="field-error">{errors[f.key]}</span>}
          </div>
        );
      })}
    </>
  );
}
