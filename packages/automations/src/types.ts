// Shared types for the Zameen automation engine.
// monday.com-style "when X, do Y" recipes stored as JSONB.

export const TRIGGER_KINDS = [
  'task_status_change',
  'task_due_soon',
  'task_overdue',
  'task_created',
  'crop_stage_advance',
  'approval_submitted',
  'approval_decided',
  'diesel_anomaly',
  'inventory_low',
  'date_arrives',
  'comment_added',
  'mention_received',
] as const;
export type TriggerKind = (typeof TRIGGER_KINDS)[number];

export const ACTION_KINDS = [
  'notify_user',
  'assign_task',
  'change_status',
  'create_subtask',
  'add_label',
  'move_to_group',
  'add_comment',
  'create_approval_request',
  'send_email',
  'send_whatsapp',
  'send_slack',
  'webhook',
] as const;
export type ActionKind = (typeof ACTION_KINDS)[number];

export type ConditionOp = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'contains' | 'exists';

export interface Condition {
  field: string;
  op: ConditionOp;
  value?: unknown;
}

export interface ActionSpec {
  kind: ActionKind;
  config: Record<string, unknown>;
}

export interface AutomationEvent<TPayload = Record<string, unknown>> {
  kind: TriggerKind;
  entityId: string | null;
  occurredAt: Date;
  payload: TPayload;
}

export interface Recipe {
  id: string;
  entityId: string | null;
  name: string;
  description?: string | null;
  triggerKind: TriggerKind;
  triggerConfig: Record<string, unknown>;
  conditions: Condition[];
  actions: ActionSpec[];
  enabled: boolean;
}

export interface ActionResult {
  kind: ActionKind;
  ok: boolean;
  detail?: string;
}
