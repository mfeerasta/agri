import type { ActionSpec, Condition, TriggerKind } from './types.js';

// Pre-baked recipes for one-tap enable in the new-recipe page.
export interface RecipeTemplate {
  slug: string;
  name: string;
  description: string;
  triggerKind: TriggerKind;
  triggerConfig: Record<string, unknown>;
  conditions: Condition[];
  actions: ActionSpec[];
}

export const RECIPE_TEMPLATES: RecipeTemplate[] = [
  {
    slug: 'fertilizer-approved-notify-worker',
    name: 'Fertiliser purchase approved → notify field worker',
    description:
      'When a fertiliser input purchase is approved, ping the assigned worker so they apply it on schedule.',
    triggerKind: 'approval_decided',
    triggerConfig: { approvalType: 'input_purchase' },
    conditions: [
      { field: 'approvalType', op: 'eq', value: 'input_purchase' },
      { field: 'decision', op: 'eq', value: 'approved' },
      { field: 'input.category', op: 'eq', value: 'fertilizer' },
    ],
    actions: [
      {
        kind: 'notify_user',
        config: {
          recipientId: '{{assignedWorkerId}}',
          title: 'Fertiliser ready to apply',
          body: '{{input.name}} approved for {{fieldName}}. Apply per crop plan.',
          deepLink: '/inputs/{{inputId}}',
        },
      },
    ],
  },
  {
    slug: 'crop-maturity-auto-harvest',
    name: 'Crop reaches maturity → auto-create harvest task',
    description: 'When a crop plan advances into the maturity stage, queue a harvest task for the supervisor.',
    triggerKind: 'crop_stage_advance',
    triggerConfig: {},
    conditions: [{ field: 'stage', op: 'eq', value: 'maturity' }],
    actions: [
      {
        kind: 'create_subtask',
        config: {
          parentTaskId: '{{cropPlanTaskId}}',
          title: 'Harvest {{cropName}} on {{fieldName}}',
        },
      },
    ],
  },
  {
    slug: 'task-overdue-2d-escalate',
    name: 'Task overdue by 2 days → escalate to supervisor',
    description: 'If a task slips two days past its due date, notify the supervisor.',
    triggerKind: 'task_overdue',
    triggerConfig: { overdueDays: 2 },
    conditions: [{ field: 'overdueDays', op: 'gte', value: 2 }],
    actions: [
      {
        kind: 'notify_user',
        config: {
          recipientId: '{{supervisorId}}',
          title: 'Task overdue',
          body: '{{taskTitle}} is {{overdueDays}} days late.',
          deepLink: '/tasks/{{taskId}}',
        },
      },
    ],
  },
  {
    slug: 'diesel-anomaly-whatsapp-mf',
    name: 'Diesel anomaly flagged → WhatsApp the director',
    description: 'When the daily anomaly detector flags abnormal fuel burn, WhatsApp the director.',
    triggerKind: 'diesel_anomaly',
    triggerConfig: {},
    conditions: [],
    actions: [
      {
        kind: 'send_whatsapp',
        config: {
          recipientId: '{{directorId}}',
          template: 'automation_alert',
          params: ['Diesel anomaly: {{assetName}} burning {{deltaPct}}% above 30-day avg'],
        },
      },
    ],
  },
  {
    slug: 'mandi-500k-director-approval',
    name: 'Mandi settlement > 500k → require director approval',
    description: 'Route large mandi settlements to the director for explicit approval.',
    triggerKind: 'approval_submitted',
    triggerConfig: { approvalType: 'crop_sale' },
    conditions: [
      { field: 'approvalType', op: 'eq', value: 'crop_sale' },
      { field: 'amountPkr', op: 'gt', value: 500000 },
    ],
    actions: [
      {
        kind: 'create_approval_request',
        config: {
          directorId: '{{directorId}}',
          title: 'Large mandi settlement: {{amountPkr}} PKR',
          body: '{{cropName}} sale at {{mandiName}} needs your sign-off.',
          deepLink: '/approvals/{{approvalRequestId}}',
        },
      },
    ],
  },
  {
    slug: 'tubewell-repair-recheck',
    name: 'Tubewell repair completed → schedule 30-day re-check',
    description: 'After a tubewell repair closes, create a follow-up task 30 days out.',
    triggerKind: 'task_status_change',
    triggerConfig: {},
    conditions: [
      { field: 'newStatus', op: 'eq', value: 'done' },
      { field: 'taskKind', op: 'eq', value: 'repair' },
      { field: 'assetCategory', op: 'eq', value: 'tubewell' },
    ],
    actions: [
      {
        kind: 'create_subtask',
        config: {
          parentTaskId: '{{taskId}}',
          title: 'Re-check tubewell repair (30 day warranty window)',
        },
      },
    ],
  },
];
