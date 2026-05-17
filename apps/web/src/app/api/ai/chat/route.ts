/**
 * POST /api/ai/chat
 *
 * Streaming chat endpoint backing the HelpDrawer. Wraps Anthropic with
 * Zameen-specific system prompt that includes a per-page context string.
 * Response is SSE: each event is `data: {"delta": "..."}\n\n`.
 */

import { z } from 'zod';
import { db } from '@zameen/db';
import { stream, HOUSE_STYLE, logAiCall, summarizePrompt } from '@zameen/shared';
import { getSessionContext } from '@/lib/session';
import { rateLimit } from '@/lib/rate-limit';
import { assertSameOrigin, CsrfError } from '@/lib/csrf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().min(1).max(4000),
      }),
    )
    .min(1)
    .max(40),
  pageContext: z.string().max(1000).optional(),
});

const SYSTEM = [
  'You are Zameen, the AI assistant for Rupafab Agri, a Pakistani farm operations platform.',
  'You help the operator (Meer) understand what is happening on his farm.',
  'Answer concisely. If asked about specific records, suggest where to find them in the UI.',
  'If the question requires data you do not have, say so and recommend a section to check.',
  HOUSE_STYLE,
].join('\n\n');

export async function POST(req: Request): Promise<Response> {
  try {
    assertSameOrigin(req);
  } catch (error) {
    if (error instanceof CsrfError) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 403,
        headers: { 'content-type': 'application/json' },
      });
    }
    throw error;
  }
  const session = await getSessionContext();
  if (!session) {
    return new Response(JSON.stringify({ error: 'Not authenticated' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }
  const limit = rateLimit(`ai-chat:${session.userId}`, 30, 60 * 60 * 1000);
  if (!limit.allowed) {
    return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
      status: 429,
      headers: { 'content-type': 'application/json' },
    });
  }

  const json = (await req.json().catch(() => null)) as unknown;
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: 'Bad request' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  const sys =
    SYSTEM +
    (parsed.data.pageContext ? `\n\nCurrent page: ${parsed.data.pageContext}` : '');
  const lastUser = [...parsed.data.messages].reverse().find((m) => m.role === 'user');
  const startedAt = Date.now();

  const encoder = new TextEncoder();
  let inputTokens = 0;
  let outputTokens = 0;

  const sse = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of stream({
          system: sys,
          messages: parsed.data.messages,
          maxTokens: 1024,
          temperature: 0.4,
        })) {
          if (chunk.delta) {
            outputTokens += Math.ceil(chunk.delta.length / 4);
            controller.enqueue(
              encoder.encode(`event: delta\ndata: ${JSON.stringify({ delta: chunk.delta })}\n\n`),
            );
          }
          if (chunk.done) {
            controller.enqueue(encoder.encode(`event: done\ndata: [DONE]\n\n`));
          }
        }
      } finally {
        inputTokens = Math.ceil((sys.length + JSON.stringify(parsed.data.messages).length) / 4);
        void logAiCall(db, {
          kind: 'chat',
          userId: session.userId,
          entityId: session.entityId,
          promptSummary: summarizePrompt(lastUser?.content ?? ''),
          inputTokens,
          outputTokens,
          latencyMs: Date.now() - startedAt,
          model: process.env.ZAMEEN_CLAUDE_MODEL ?? 'claude-3-5-sonnet-20241022',
        });
        controller.close();
      }
    },
  });

  return new Response(sse, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
    },
  });
}
