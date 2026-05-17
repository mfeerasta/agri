import type { AutomationEvent, Condition } from './types.js';

// Resolves dotted paths like 'task.amount' against an event payload.
function resolvePath(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc === null || acc === undefined) return undefined;
    if (typeof acc !== 'object') return undefined;
    return (acc as Record<string, unknown>)[key];
  }, obj);
}

export function evaluateCondition(c: Condition, event: AutomationEvent): boolean {
  const raw = resolvePath(event.payload, c.field);
  switch (c.op) {
    case 'eq':
      return raw === c.value;
    case 'neq':
      return raw !== c.value;
    case 'gt':
      return typeof raw === 'number' && typeof c.value === 'number' && raw > c.value;
    case 'gte':
      return typeof raw === 'number' && typeof c.value === 'number' && raw >= c.value;
    case 'lt':
      return typeof raw === 'number' && typeof c.value === 'number' && raw < c.value;
    case 'lte':
      return typeof raw === 'number' && typeof c.value === 'number' && raw <= c.value;
    case 'in':
      return Array.isArray(c.value) && (c.value as unknown[]).includes(raw);
    case 'contains':
      if (typeof raw === 'string' && typeof c.value === 'string') return raw.includes(c.value);
      if (Array.isArray(raw)) return (raw as unknown[]).includes(c.value);
      return false;
    case 'exists':
      return raw !== undefined && raw !== null;
    default:
      return false;
  }
}

export function evaluateConditions(conditions: Condition[], event: AutomationEvent): boolean {
  // ANDed together; empty array means "always".
  return conditions.every((c) => evaluateCondition(c, event));
}
