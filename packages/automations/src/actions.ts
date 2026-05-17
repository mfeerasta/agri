import { db, notifications, tasks, taskAssignments, entityComments, entityActivity, users } from '@zameen/db';
import { eq } from 'drizzle-orm';
import { sendTemplate } from '@zameen/shared';
import { postSlackMessage } from '@zameen/shared/integrations/slack';
import type { ActionResult, ActionSpec, AutomationEvent } from './types.js';

// Each handler returns {ok, detail} so the engine can log partial failures.
// Handlers must never throw.

type Handler = (config: Record<string, unknown>, event: AutomationEvent) => Promise<ActionResult>;

function s(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

function interpolate(template: string, event: AutomationEvent): string {
  // Simple {{path}} interpolation against event.payload.
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, path: string) => {
    const parts = path.split('.');
    let cur: unknown = event.payload;
    for (const p of parts) {
      if (cur && typeof cur === 'object') cur = (cur as Record<string, unknown>)[p];
      else return '';
    }
    return cur == null ? '' : String(cur);
  });
}

const notifyUser: Handler = async (config, event) => {
  try {
    const recipientId = s(config.recipientId);
    if (!recipientId) return { kind: 'notify_user', ok: false, detail: 'no recipientId' };
    const title = interpolate(s(config.title, 'Automation'), event);
    const body = interpolate(s(config.body, ''), event);
    await db.insert(notifications).values({
      recipientId,
      entityId: event.entityId,
      channel: 'in_app',
      category: 'automation',
      title,
      body,
      deepLink: s(config.deepLink) || null,
      payload: { triggerKind: event.kind, ...event.payload },
    });
    return { kind: 'notify_user', ok: true };
  } catch (err) {
    return { kind: 'notify_user', ok: false, detail: (err as Error).message };
  }
};

const assignTask: Handler = async (config, event) => {
  try {
    const taskId = s(config.taskId) || s((event.payload as { taskId?: string }).taskId);
    const workerId = s(config.workerId) || s(config.assigneeId);
    if (!taskId || !workerId) return { kind: 'assign_task', ok: false, detail: 'missing taskId/workerId' };
    await db.insert(taskAssignments).values({ taskId, workerId });
    return { kind: 'assign_task', ok: true };
  } catch (err) {
    return { kind: 'assign_task', ok: false, detail: (err as Error).message };
  }
};

const changeStatus: Handler = async (config, event) => {
  try {
    const taskId = s(config.taskId) || s((event.payload as { taskId?: string }).taskId);
    const status = s(config.status);
    if (!taskId || !status) return { kind: 'change_status', ok: false, detail: 'missing taskId/status' };
    await db.update(tasks).set({ status }).where(eq(tasks.id, taskId));
    return { kind: 'change_status', ok: true };
  } catch (err) {
    return { kind: 'change_status', ok: false, detail: (err as Error).message };
  }
};

const createSubtask: Handler = async (config, event) => {
  try {
    const parentTaskId = s(config.parentTaskId) || s((event.payload as { taskId?: string }).taskId);
    const title = interpolate(s(config.title, 'Sub-task'), event);
    if (!parentTaskId || !event.entityId) {
      return { kind: 'create_subtask', ok: false, detail: 'missing parent or entity' };
    }
    await db.insert(tasks).values({
      entityId: event.entityId,
      parentTaskId,
      title,
      taskKind: s(config.taskKind, 'followup'),
      status: 'open',
      priority: 'medium',
      createdBy: s(config.createdBy) || null,
    });
    return { kind: 'create_subtask', ok: true };
  } catch (err) {
    return { kind: 'create_subtask', ok: false, detail: (err as Error).message };
  }
};

const addLabel: Handler = async (config, event) => {
  try {
    const taskId = s(config.taskId) || s((event.payload as { taskId?: string }).taskId);
    const label = s(config.label);
    if (!taskId || !label) return { kind: 'add_label', ok: false, detail: 'missing taskId/label' };
    await db.insert(entityActivity).values({
      entityKind: 'task',
      entityId: taskId,
      verb: 'label.added',
      payload: { label },
    });
    return { kind: 'add_label', ok: true };
  } catch (err) {
    return { kind: 'add_label', ok: false, detail: (err as Error).message };
  }
};

const moveToGroup: Handler = async (config, event) => {
  // Tasks table has no groupKey column; record group membership as an activity
  // entry so existing UI can derive grouping until a dedicated column lands.
  try {
    const taskId = s(config.taskId) || s((event.payload as { taskId?: string }).taskId);
    const group = s(config.group);
    if (!taskId || !group) return { kind: 'move_to_group', ok: false, detail: 'missing taskId/group' };
    await db.insert(entityActivity).values({
      entityKind: 'task',
      entityId: taskId,
      verb: 'group.moved',
      payload: { group },
    });
    return { kind: 'move_to_group', ok: true };
  } catch (err) {
    return { kind: 'move_to_group', ok: false, detail: (err as Error).message };
  }
};

const addComment: Handler = async (config, event) => {
  try {
    const entityId = s(config.entityId) || s((event.payload as { entityId?: string; taskId?: string }).entityId) || s((event.payload as { taskId?: string }).taskId);
    const entityKind = s(config.entityKind, 'task') as 'task' | 'approval' | 'repair' | 'crop_plan' | 'feasibility';
    const body = interpolate(s(config.body, ''), event);
    const authorId = s(config.authorId);
    if (!entityId || !body || !authorId) return { kind: 'add_comment', ok: false, detail: 'missing entityId/body/authorId' };
    await db.insert(entityComments).values({
      entityKind,
      entityId,
      authorId,
      body,
    });
    return { kind: 'add_comment', ok: true };
  } catch (err) {
    return { kind: 'add_comment', ok: false, detail: (err as Error).message };
  }
};

const createApprovalRequest: Handler = async (config, event) => {
  // Surface-level: queue a notification to the routed approver chain.
  // Full submitApproval call happens in the originating server action; this
  // handler is for ad-hoc escalations triggered by recipes (e.g. >500k mandi).
  try {
    const directorId = s(config.directorId);
    const title = interpolate(s(config.title, 'Approval needed'), event);
    if (!directorId) return { kind: 'create_approval_request', ok: false, detail: 'no directorId' };
    await db.insert(notifications).values({
      recipientId: directorId,
      entityId: event.entityId,
      channel: 'in_app',
      category: 'approval',
      title,
      body: interpolate(s(config.body, ''), event),
      deepLink: s(config.deepLink) || null,
      payload: event.payload,
    });
    return { kind: 'create_approval_request', ok: true };
  } catch (err) {
    return { kind: 'create_approval_request', ok: false, detail: (err as Error).message };
  }
};

const sendEmail: Handler = async (config, event) => {
  try {
    const recipientId = s(config.recipientId);
    if (!recipientId) return { kind: 'send_email', ok: false, detail: 'no recipientId' };
    const [u] = await db.select().from(users).where(eq(users.id, recipientId)).limit(1);
    if (!u?.email) return { kind: 'send_email', ok: false, detail: 'no email on user' };
    await db.insert(notifications).values({
      recipientId,
      entityId: event.entityId,
      channel: 'email',
      category: 'automation',
      title: interpolate(s(config.subject, 'Zameen'), event),
      body: interpolate(s(config.body, ''), event),
    });
    return { kind: 'send_email', ok: true };
  } catch (err) {
    return { kind: 'send_email', ok: false, detail: (err as Error).message };
  }
};

const sendWhatsapp: Handler = async (config, event) => {
  try {
    const recipientId = s(config.recipientId);
    if (!recipientId) return { kind: 'send_whatsapp', ok: false, detail: 'no recipientId' };
    const [u] = await db.select().from(users).where(eq(users.id, recipientId)).limit(1);
    if (!u?.phone) return { kind: 'send_whatsapp', ok: false, detail: 'no phone on user' };
    const template = s(config.template, 'automation_alert');
    const params = Array.isArray(config.params)
      ? (config.params as string[]).map((p) => interpolate(p, event))
      : [];
    await sendTemplate({ to: u.phone, template, params });
    return { kind: 'send_whatsapp', ok: true };
  } catch (err) {
    return { kind: 'send_whatsapp', ok: false, detail: (err as Error).message };
  }
};

const sendSlack: Handler = async (config, event) => {
  try {
    const webhookUrl = s(config.webhookUrl);
    if (!webhookUrl) return { kind: 'send_slack', ok: false, detail: 'no webhookUrl' };
    const text = interpolate(s(config.text, ''), event);
    const result = await postSlackMessage({ webhookUrl, text });
    return { kind: 'send_slack', ok: result.ok, detail: result.detail };
  } catch (err) {
    return { kind: 'send_slack', ok: false, detail: (err as Error).message };
  }
};

const webhook: Handler = async (config, event) => {
  try {
    const url = s(config.url);
    if (!url) return { kind: 'webhook', ok: false, detail: 'no url' };
    const res = await fetch(url, {
      method: s(config.method, 'POST'),
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ event, config }),
    });
    return { kind: 'webhook', ok: res.ok, detail: `HTTP ${res.status}` };
  } catch (err) {
    return { kind: 'webhook', ok: false, detail: (err as Error).message };
  }
};

export const ACTION_HANDLERS: Record<string, Handler> = {
  notify_user: notifyUser,
  assign_task: assignTask,
  change_status: changeStatus,
  create_subtask: createSubtask,
  add_label: addLabel,
  move_to_group: moveToGroup,
  add_comment: addComment,
  create_approval_request: createApprovalRequest,
  send_email: sendEmail,
  send_whatsapp: sendWhatsapp,
  send_slack: sendSlack,
  webhook,
};

export async function executeAction(spec: ActionSpec, event: AutomationEvent): Promise<ActionResult> {
  const handler = ACTION_HANDLERS[spec.kind];
  if (!handler) return { kind: spec.kind, ok: false, detail: 'unknown action kind' };
  return handler(spec.config ?? {}, event);
}
