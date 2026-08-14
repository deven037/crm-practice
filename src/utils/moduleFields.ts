import { getAllSync } from '../data/store';
import {
  CAMPAIGN_CHANNELS,
  CAMPAIGN_STATUSES,
  CustomFieldDef,
  CustomFieldModule,
  DEAL_STAGES,
  LEAD_SOURCES,
  LEAD_STATUSES,
  PRODUCT_CATEGORIES,
} from '../types';
import { getStatusOptions } from './rules';

export type FieldKind = 'text' | 'number' | 'boolean' | 'select';

export interface ModuleFieldDef {
  /** System fields use their literal record key (e.g. 'status'); custom fields use their CustomFieldDef id. */
  key: string;
  label: string;
  kind: FieldKind;
  options?: string[];
  /** True for CustomFieldDef-backed entries — the layout designer and condition picker both need to know this to read/write the right place on a record (`record[key]` vs `record.customFields[key]`). */
  isCustom?: boolean;
}

/** Every module's built-in (non-custom) fields — the source of truth for both the rule-condition field picker and the Layout Designer's "system fields" palette. */
function systemFieldsFor(module: CustomFieldModule): ModuleFieldDef[] {
  switch (module) {
    case 'leads':
      return [
        { key: 'name', label: 'Name', kind: 'text' },
        { key: 'company', label: 'Company', kind: 'text' },
        { key: 'email', label: 'Email', kind: 'text' },
        { key: 'phone', label: 'Phone', kind: 'text' },
        { key: 'status', label: 'Status', kind: 'select', options: getStatusOptions('leads', 'status', LEAD_STATUSES) },
        { key: 'source', label: 'Source', kind: 'select', options: LEAD_SOURCES },
        { key: 'value', label: 'Value', kind: 'number' },
        { key: 'ownerId', label: 'Owner', kind: 'text' },
      ];
    case 'contacts':
      return [
        { key: 'name', label: 'Name', kind: 'text' },
        { key: 'email', label: 'Email', kind: 'text' },
        { key: 'phone', label: 'Phone', kind: 'text' },
        { key: 'title', label: 'Job title', kind: 'text' },
        { key: 'accountId', label: 'Account', kind: 'text' },
      ];
    case 'accounts':
      return [
        { key: 'name', label: 'Name', kind: 'text' },
        { key: 'industry', label: 'Industry', kind: 'text' },
        { key: 'employees', label: 'Employees', kind: 'number' },
        { key: 'revenue', label: 'Revenue', kind: 'number' },
        { key: 'website', label: 'Website', kind: 'text' },
        { key: 'phone', label: 'Phone', kind: 'text' },
        { key: 'ownerId', label: 'Owner', kind: 'text' },
      ];
    case 'deals':
      return [
        { key: 'name', label: 'Name', kind: 'text' },
        { key: 'accountId', label: 'Account', kind: 'text' },
        { key: 'amount', label: 'Amount', kind: 'number' },
        { key: 'stage', label: 'Stage', kind: 'select', options: getStatusOptions('deals', 'stage', DEAL_STAGES) },
        { key: 'probability', label: 'Win probability', kind: 'number' },
        { key: 'closeDate', label: 'Expected close', kind: 'text' },
        { key: 'ownerId', label: 'Owner', kind: 'text' },
      ];
    case 'products':
      return [
        { key: 'name', label: 'Name', kind: 'text' },
        { key: 'sku', label: 'SKU', kind: 'text' },
        { key: 'category', label: 'Category', kind: 'select', options: PRODUCT_CATEGORIES },
        { key: 'price', label: 'Price', kind: 'number' },
        { key: 'description', label: 'Description', kind: 'text' },
        { key: 'active', label: 'Active', kind: 'boolean' },
      ];
    case 'tickets':
      return [
        { key: 'subject', label: 'Subject', kind: 'text' },
        { key: 'requester', label: 'Requester', kind: 'text' },
        { key: 'priority', label: 'Priority', kind: 'select', options: ['Low', 'Medium', 'High', 'Urgent'] },
        { key: 'description', label: 'Description', kind: 'text' },
      ];
    case 'campaigns':
      return [
        { key: 'name', label: 'Name', kind: 'text' },
        { key: 'channel', label: 'Channel', kind: 'select', options: getStatusOptions('campaigns', 'channel', CAMPAIGN_CHANNELS) },
        { key: 'budget', label: 'Budget', kind: 'number' },
        { key: 'status', label: 'Status', kind: 'select', options: getStatusOptions('campaigns', 'status', CAMPAIGN_STATUSES) },
        { key: 'startDate', label: 'Start date', kind: 'text' },
        { key: 'endDate', label: 'End date', kind: 'text' },
      ];
    case 'quotes':
      return [
        { key: 'quoteNumber', label: 'Quote #', kind: 'text' },
        { key: 'accountId', label: 'Account', kind: 'text' },
        { key: 'validUntil', label: 'Valid until', kind: 'text' },
      ];
  }
}

export function getSystemFields(module: CustomFieldModule): ModuleFieldDef[] {
  return systemFieldsFor(module);
}

export function getCustomFieldsAsModuleFields(module: CustomFieldModule): ModuleFieldDef[] {
  return getAllSync<CustomFieldDef>('customFieldDefs')
    .filter((d) => d.module === module)
    .map((d) => ({
      key: d.id,
      label: d.label,
      kind: d.type === 'dropdown' ? 'select' : d.type === 'checkbox' ? 'boolean' : d.type === 'number' ? 'number' : 'text',
      options: d.options,
      isCustom: true,
    }));
}

/** System fields followed by this module's custom fields — every field a record of this module actually has. */
export function getAllModuleFields(module: CustomFieldModule): ModuleFieldDef[] {
  return [...getSystemFields(module), ...getCustomFieldsAsModuleFields(module)];
}
