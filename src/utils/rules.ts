import { getAllSync } from '../data/store';
import { AssignmentRule, AssignmentRuleModule, CustomFieldDef, DedupeRule, DedupeRuleModule, StatusCodeModule, StatusCodeSet } from '../types';

/** Setup → Status Codes: options for a module+field <Select>, falling back to the hardcoded constant if unconfigured. */
export function getStatusOptions(module: StatusCodeModule, field: string, fallback: string[]): string[] {
  const set = getAllSync<StatusCodeSet>('statusCodeSets').find((s) => s.module === module && s.field === field);
  return set && set.options.length > 0 ? set.options : fallback;
}

/** `field` is either a literal system-field key (e.g. 'status', 'layoutName') or a CustomFieldDef id. */
export function fieldOf(record: object, field: string): unknown {
  const rec = record as Record<string, unknown>;
  if (field in rec) return rec[field];
  const customFields = rec.customFields as Record<string, unknown> | undefined;
  if (customFields) {
    const def = getAllSync<CustomFieldDef>('customFieldDefs').find((d) => d.id === field);
    if (def) return customFields[def.key];
  }
  return undefined;
}

/** Shared by Assignment Rules, Dedupe Rules, and AutoFlow's decision/gateway branch routing — one condition-matching implementation, not reimplemented per feature. */
export function matchesCondition(record: object, condition: { field: string; operator: string; value: string }): boolean {
  const fieldValue = String(fieldOf(record, condition.field) ?? '');
  if (condition.operator === 'equals') return fieldValue === condition.value;
  return fieldValue.toLowerCase().includes(condition.value.toLowerCase());
}

/** First active rule (by ascending priority) whose every condition matches — returns the userId to assign, or null. */
export function applyAssignmentRule<T extends object>(module: AssignmentRuleModule, record: T): string | null {
  const rules = getAllSync<AssignmentRule>('assignmentRules')
    .filter((r) => r.module === module && r.active)
    .sort((a, b) => a.priority - b.priority);
  for (const rule of rules) {
    if (rule.conditions.length > 0 && rule.conditions.every((c) => matchesCondition(record, c))) return rule.assignTo;
  }
  return null;
}

/** First existing record matching an active dedupe rule's fields, or null. Empty match-field values never match. */
export function findDuplicate<T extends { id: string }>(module: DedupeRuleModule, draft: T, existing: T[]): T | null {
  const rules = getAllSync<DedupeRule>('dedupeRules').filter((r) => r.module === module && r.active);
  for (const rule of rules) {
    const match = existing.find((item) => {
      if (item.id === draft.id) return false;
      return rule.matchFields.every((field) => {
        const a = String(fieldOf(draft, field) ?? '').trim().toLowerCase();
        const b = String(fieldOf(item, field) ?? '').trim().toLowerCase();
        if (!a) return false;
        return rule.matchType === 'exact' ? a === b : a.includes(b) || b.includes(a);
      });
    });
    if (match) return match;
  }
  return null;
}
