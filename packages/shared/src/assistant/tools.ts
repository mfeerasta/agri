/**
 * Tool registry for the Zameen AI farm assistant.
 *
 * Each tool has:
 *  - name: stable identifier sent to Claude
 *  - description: shown to the model so it knows when to invoke
 *  - inputSchema: Zod schema validated before handler runs
 *  - handler: receives validated input + caller session, returns JSON-able value
 *  - permission: read-only or write; write tools enforce approval routing
 *
 * Handlers are kept thin and delegate to existing server actions or db
 * helpers. Importers compose the registry into a runtime context that
 * binds the caller's session before any handler runs.
 */

import { z } from 'zod';

export interface ToolSession {
  userId: string;
  entityId: string;
  channel: 'web' | 'field_pwa' | 'whatsapp' | 'ops_pwa';
  locale: 'en' | 'ur' | 'roman_ur';
}

export interface ToolDefinition<TInput = unknown, TOutput = unknown> {
  name: string;
  description: string;
  inputSchema: z.ZodType<TInput>;
  permission: 'read' | 'write';
  /** Set true for write tools that must route through the approval engine. */
  requiresApproval?: boolean;
  handler: (input: TInput, session: ToolSession) => Promise<TOutput>;
}

// Schemas. Kept in this file so the registry export is self-contained.

const fieldIdSchema = z.object({ fieldId: z.string().uuid() });
const dateRangeSchema = z.object({
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  fieldId: z.string().uuid().optional(),
});

export const queryFieldPnlInput = fieldIdSchema.extend({
  season: z.string().min(3).max(20),
});
export const queryDieselConsumptionInput = dateRangeSchema;
export const queryWeatherForecastInput = fieldIdSchema.extend({
  days: z.number().int().min(1).max(14),
});
export const queryIrrigationStatusInput = fieldIdSchema;
export const queryInventoryLevelInput = z.object({ inputName: z.string().min(1) });
export const queryActiveApprovalsInput = z.object({}).strict();
export const queryRecentHarvestsInput = z.object({
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
export const queryOutstandingPaymentsInput = z.object({}).strict();
export const scheduleIrrigationInput = fieldIdSchema.extend({
  dateTime: z.string().datetime(),
});
export const submitApprovalToolInput = z.object({
  approvalType: z.string(),
  amountPkr: z.number().int().nonnegative().optional(),
  contextSnapshot: z.record(z.unknown()),
  requestedById: z.string().uuid(),
  reason: z.string().optional(),
});
export const recordObservationInput = z.object({
  fieldId: z.string().uuid(),
  photoUrl: z.string().url(),
  description: z.string().min(1),
});
export const markAttendanceInput = z.object({
  workerId: z.string().uuid(),
  fieldId: z.string().uuid(),
});

// Handler dependency surface. Apps provide concrete implementations when
// constructing the registry. This avoids a hard import of server-only code
// from this package.
export interface ToolDependencies {
  computeFieldPnL: (cropPlanId: string) => Promise<Record<string, unknown>>;
  queryDieselConsumption: (input: z.infer<typeof queryDieselConsumptionInput>) => Promise<unknown>;
  queryWeatherForecast: (input: z.infer<typeof queryWeatherForecastInput>) => Promise<unknown>;
  queryIrrigationStatus: (input: z.infer<typeof queryIrrigationStatusInput>) => Promise<unknown>;
  queryInventoryLevel: (input: z.infer<typeof queryInventoryLevelInput>) => Promise<unknown>;
  queryActiveApprovals: (session: ToolSession) => Promise<unknown>;
  queryRecentHarvests: (input: z.infer<typeof queryRecentHarvestsInput>, session: ToolSession) => Promise<unknown>;
  queryOutstandingPayments: (session: ToolSession) => Promise<unknown>;
  scheduleIrrigation: (input: z.infer<typeof scheduleIrrigationInput>, session: ToolSession) => Promise<unknown>;
  submitApproval: (input: z.infer<typeof submitApprovalToolInput>, session: ToolSession) => Promise<unknown>;
  recordObservation: (input: z.infer<typeof recordObservationInput>, session: ToolSession) => Promise<unknown>;
  markAttendance: (input: z.infer<typeof markAttendanceInput>, session: ToolSession) => Promise<unknown>;
  // For pnl, callers must resolve fieldId+season to cropPlanId. We expose a
  // separate resolver to keep tool concerns simple.
  resolveCropPlan: (input: z.infer<typeof queryFieldPnlInput>, session: ToolSession) => Promise<string | null>;
}

export function buildToolRegistry(deps: ToolDependencies): ToolDefinition[] {
  return [
    {
      name: 'query_field_pnl',
      description:
        'Get profit and loss for one field for a given season. Returns revenue, cost pools, net PKR.',
      inputSchema: queryFieldPnlInput,
      permission: 'read',
      handler: async (raw, session) => {
        const input = queryFieldPnlInput.parse(raw);
        const cropPlanId = await deps.resolveCropPlan(input, session);
        if (!cropPlanId) return { error: 'no_crop_plan_for_field_and_season' };
        return deps.computeFieldPnL(cropPlanId);
      },
    },
    {
      name: 'query_diesel_consumption',
      description:
        'Sum diesel litres and PKR cost across a date range, optionally scoped to one field.',
      inputSchema: queryDieselConsumptionInput,
      permission: 'read',
      handler: async (raw) => deps.queryDieselConsumption(queryDieselConsumptionInput.parse(raw)),
    },
    {
      name: 'query_weather_forecast',
      description: 'Hourly weather forecast for a field, up to 14 days ahead.',
      inputSchema: queryWeatherForecastInput,
      permission: 'read',
      handler: async (raw) => deps.queryWeatherForecast(queryWeatherForecastInput.parse(raw)),
    },
    {
      name: 'query_irrigation_status',
      description:
        'Most recent irrigation events plus the warabandi slot for a field. Use to assess irrigation gaps.',
      inputSchema: queryIrrigationStatusInput,
      permission: 'read',
      handler: async (raw) => deps.queryIrrigationStatus(queryIrrigationStatusInput.parse(raw)),
    },
    {
      name: 'query_inventory_level',
      description: 'Current stock level for a named input (urea, DAP, fungicide name, etc.).',
      inputSchema: queryInventoryLevelInput,
      permission: 'read',
      handler: async (raw) => deps.queryInventoryLevel(queryInventoryLevelInput.parse(raw)),
    },
    {
      name: 'query_active_approvals',
      description: 'List approvals waiting on the caller or their team.',
      inputSchema: queryActiveApprovalsInput,
      permission: 'read',
      handler: async (_raw, session) => deps.queryActiveApprovals(session),
    },
    {
      name: 'query_recent_harvests',
      description: 'List harvest logs in a date range with crop, field, quantity, grade.',
      inputSchema: queryRecentHarvestsInput,
      permission: 'read',
      handler: async (raw, session) =>
        deps.queryRecentHarvests(queryRecentHarvestsInput.parse(raw), session),
    },
    {
      name: 'query_outstanding_payments',
      description: 'Outstanding payables and receivables with due dates. Cash flow snapshot.',
      inputSchema: queryOutstandingPaymentsInput,
      permission: 'read',
      handler: async (_raw, session) => deps.queryOutstandingPayments(session),
    },
    {
      name: 'schedule_irrigation',
      description: 'Schedule an irrigation event. Routes through approval if amount or area triggers a threshold.',
      inputSchema: scheduleIrrigationInput,
      permission: 'write',
      requiresApproval: true,
      handler: async (raw, session) =>
        deps.scheduleIrrigation(scheduleIrrigationInput.parse(raw), session),
    },
    {
      name: 'submit_approval',
      description: 'Submit a generic approval request via the approval engine.',
      inputSchema: submitApprovalToolInput,
      permission: 'write',
      requiresApproval: true,
      handler: async (raw, session) =>
        deps.submitApproval(submitApprovalToolInput.parse(raw), session),
    },
    {
      name: 'record_observation',
      description: 'Insert a scouting observation with a photo URL and description.',
      inputSchema: recordObservationInput,
      permission: 'write',
      handler: async (raw, session) =>
        deps.recordObservation(recordObservationInput.parse(raw), session),
    },
    {
      name: 'mark_attendance',
      description: 'Mark a worker present at a field for today.',
      inputSchema: markAttendanceInput,
      permission: 'write',
      handler: async (raw, session) =>
        deps.markAttendance(markAttendanceInput.parse(raw), session),
    },
  ];
}

/** Serialize the registry to the Claude tool-use schema. */
export function toClaudeTools(registry: ToolDefinition[]): Array<{
  name: string;
  description: string;
  input_schema: { type: 'object'; properties: Record<string, unknown>; required: string[] };
}> {
  return registry.map((t) => {
    const jsonSchema = zodToJsonSchema(t.inputSchema);
    return {
      name: t.name,
      description: t.description,
      input_schema: jsonSchema,
    };
  });
}

// Minimal Zod-to-JSON-Schema for our tool input shapes. We use a tiny
// hand-rolled walker because we want zero new dependencies and the inputs
// here are constrained.
function zodToJsonSchema(schema: z.ZodType): {
  type: 'object';
  properties: Record<string, unknown>;
  required: string[];
} {
  if (!(schema instanceof z.ZodObject)) {
    return { type: 'object', properties: {}, required: [] };
  }
  const shape = schema.shape as Record<string, z.ZodTypeAny>;
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  for (const [key, val] of Object.entries(shape)) {
    const def = val._def as { typeName: string };
    let prop: Record<string, unknown> = { type: 'string' };
    if (def.typeName === 'ZodNumber') prop = { type: 'number' };
    else if (def.typeName === 'ZodBoolean') prop = { type: 'boolean' };
    else if (def.typeName === 'ZodObject') prop = { type: 'object' };
    else if (def.typeName === 'ZodRecord') prop = { type: 'object' };
    properties[key] = prop;
    if (!val.isOptional()) required.push(key);
  }
  return { type: 'object', properties, required };
}
