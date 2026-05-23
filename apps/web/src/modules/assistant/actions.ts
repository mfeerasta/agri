'use server';

import { db, assistantConversations, assistantMessages, assistantRecommendations } from '@zameen/db';
import { eq, sql } from 'drizzle-orm';
import { runAssistantTurn, buildToolRegistry, type ToolDependencies, type ToolSession } from '@zameen/shared/assistant';
import { getSessionContext } from '@/lib/session';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

type ServerResult<T = void> = { ok: true; data: T } | { ok: false; error: string };

const startInput = z.object({
  channel: z.enum(['web', 'field_pwa', 'whatsapp', 'ops_pwa']).default('web'),
  contextSnapshot: z.record(z.unknown()).optional(),
});

export async function startConversation(raw: unknown): Promise<ServerResult<{ id: string }>> {
  const parsed = startInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  const session = await getSessionContext();
  const [row] = await db
    .insert(assistantConversations)
    .values({
      userId: session.userId,
      entityId: session.entityId,
      channel: parsed.data.channel,
      contextSnapshot: parsed.data.contextSnapshot ?? null,
    })
    .returning({ id: assistantConversations.id });
  return { ok: true, data: { id: row.id } };
}

const sendInput = z.object({
  conversationId: z.string().uuid(),
  userMessage: z.string().optional(),
  voiceUrl: z.string().url().optional(),
  locale: z.enum(['en', 'ur', 'roman_ur']).default('en'),
});

// Minimal stub dependency wiring. Real implementations live in their own
// modules and are imported here to keep the engine pluggable.
function buildDeps(): ToolDependencies {
  return {
    computeFieldPnL: async () => ({ note: 'wire to @zameen/finance computeFieldPnL' }),
    queryDieselConsumption: async () => ({ note: 'wire to diesel module' }),
    queryWeatherForecast: async () => ({ note: 'wire to weather_hourly query' }),
    queryIrrigationStatus: async () => ({ note: 'wire to irrigation module' }),
    queryInventoryLevel: async () => ({ note: 'wire to inventory module' }),
    queryActiveApprovals: async () => ({ note: 'wire to approval_requests' }),
    queryRecentHarvests: async () => ({ note: 'wire to harvest_logs' }),
    queryOutstandingPayments: async () => ({ note: 'wire to finance cashflow' }),
    scheduleIrrigation: async () => ({ note: 'wire to irrigation action' }),
    submitApproval: async () => ({ note: 'wire to submitApproval' }),
    recordObservation: async () => ({ note: 'wire to scouting insert' }),
    markAttendance: async () => ({ note: 'wire to attendance action' }),
    resolveCropPlan: async () => null,
  };
}

export async function sendAssistantMessage(raw: unknown): Promise<ServerResult<{ text: string }>> {
  const parsed = sendInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  const ctx = await getSessionContext();
  const session: ToolSession = {
    userId: ctx.userId,
    entityId: ctx.entityId,
    channel: 'web',
    locale: parsed.data.locale,
  };

  // Pull prior messages for history.
  const prior = await db.query.assistantMessages.findMany({
    where: eq(assistantMessages.conversationId, parsed.data.conversationId),
    orderBy: assistantMessages.createdAt,
  });
  const history = prior
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: [{ type: 'text' as const, text: m.content }],
    }));

  const result = await runAssistantTurn({
    conversationId: parsed.data.conversationId,
    userMessage: parsed.data.userMessage,
    voiceUrl: parsed.data.voiceUrl,
    session,
    tools: buildToolRegistry(buildDeps()),
    history,
    persist: {
      saveMessage: async (msg) => {
        await db.insert(assistantMessages).values({
          conversationId: msg.conversationId,
          role: msg.role,
          content: msg.content,
          contentUr: msg.contentUr ?? null,
          voiceUrl: msg.voiceUrl ?? null,
          toolCalls: msg.toolCalls ?? null,
          toolResults: msg.toolResults ?? null,
          tokensInput: msg.tokensInput ?? null,
          tokensOutput: msg.tokensOutput ?? null,
          cachedTokens: msg.cachedTokens ?? null,
        });
      },
      bumpConversationUsage: async (id, tokens, costPkr) => {
        await db
          .update(assistantConversations)
          .set({
            totalTokens: sql`${assistantConversations.totalTokens} + ${tokens}`,
            totalCostUsd: sql`${assistantConversations.totalCostUsd} + ${costPkr / 280}`,
          })
          .where(eq(assistantConversations.id, id));
      },
    },
  });

  return { ok: true, data: { text: result.finalText } };
}

const ackInput = z.object({ id: z.string().uuid(), action: z.enum(['ack', 'act', 'dismiss']), reason: z.string().optional() });

export async function actOnRecommendation(raw: unknown): Promise<ServerResult> {
  const parsed = ackInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  const now = new Date();
  const patch =
    parsed.data.action === 'ack'
      ? { acknowledgedAt: now }
      : parsed.data.action === 'act'
        ? { actedOnAt: now }
        : { dismissedAt: now, dismissReason: parsed.data.reason ?? null };
  await db.update(assistantRecommendations).set(patch).where(eq(assistantRecommendations.id, parsed.data.id));
  revalidatePath('/app/recommendations');
  return { ok: true, data: undefined };
}
