/**
 * Core conversation engine for the Zameen AI farm assistant.
 *
 * Pipeline:
 *   1. (Optional) Whisper transcribe the voice clip.
 *   2. Append the user message to the conversation.
 *   3. Call Claude with the cached system + tool registry.
 *   4. While stop_reason === 'tool_use':
 *        - Validate + execute each tool call against the registry.
 *        - Append a tool_result message.
 *        - Call Claude again with the augmented history.
 *   5. Stream the final assistant text back to the caller and persist it.
 *
 * Token + cost tracking is rolled up onto assistant_conversations.
 *
 * Prompt caching:
 *   - The system prompt is large and stable: tagged ephemeral.
 *   - The tool registry JSON is appended as a cached reference block.
 */

import { estimateCostPkr, HOUSE_STYLE } from '../anthropic.js';
import { toClaudeTools, type ToolDefinition, type ToolSession } from './tools.js';
import { transcribeAudio } from './voice.js';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const DEFAULT_MODEL = 'claude-3-5-sonnet-20241022';
const TURN_TIMEOUT_MS = 60_000;
const MAX_TOOL_ITERATIONS = 6;

export interface RunAssistantTurnInput {
  conversationId: string;
  userMessage?: string;
  voiceUrl?: string;
  session: ToolSession;
  tools: ToolDefinition[];
  /** Persisted message history to send to the model. */
  history: Array<{ role: 'user' | 'assistant'; content: ContentBlock[] }>;
  onChunk?: (delta: string) => void;
  /** Persistence hooks. Engine stays stateless if these are stubbed. */
  persist: ConversationPersist;
}

export interface ConversationPersist {
  saveMessage: (msg: PersistMessage) => Promise<void>;
  bumpConversationUsage: (id: string, tokens: number, costPkr: number) => Promise<void>;
}

export interface PersistMessage {
  conversationId: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  contentUr?: string;
  voiceUrl?: string;
  toolCalls?: unknown;
  toolResults?: unknown;
  tokensInput?: number;
  tokensOutput?: number;
  cachedTokens?: number;
}

type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean };

interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: ContentBlock[];
}

interface ClaudeResponse {
  stop_reason: 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence';
  content: ContentBlock[];
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  };
}

export interface AssistantTurnResult {
  finalText: string;
  toolCalls: Array<{ name: string; input: Record<string, unknown>; result: unknown }>;
  totalUsage: {
    input: number;
    output: number;
    cached: number;
    cacheCreation: number;
  };
  costPkr: number;
}

function buildSystemPrompt(session: ToolSession): string {
  const langLine =
    session.locale === 'ur'
      ? 'Reply in Urdu script. Use simple sentences.'
      : session.locale === 'roman_ur'
        ? 'Reply in Roman Urdu (Latin letters, Urdu words).'
        : 'Reply in English. Use Urdu only when quoting source text.';

  return [
    'You are Zameen, the farm management assistant for Rupafab Agri.',
    'You answer questions across modules: fields, crops, diesel, irrigation, inputs, harvests, finance, approvals, weather, workers.',
    'You can call read tools to fetch live data and write tools to take action.',
    'For any monetary action above PKR thresholds, route through submit_approval.',
    'Cite tool results inline when relevant. Do not invent numbers.',
    'Photos are mandatory for diesel purchase, repair issues, and final invoices.',
    langLine,
    HOUSE_STYLE,
  ].join('\n');
}

function getApiKey(): string | null {
  return process.env.ANTHROPIC_API_KEY ?? null;
}

async function callClaude(
  messages: ClaudeMessage[],
  systemPrompt: string,
  toolsForClaude: ReturnType<typeof toClaudeTools>,
): Promise<ClaudeResponse | null> {
  const key = getApiKey();
  if (!key) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TURN_TIMEOUT_MS);
  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: process.env.ZAMEEN_CLAUDE_MODEL ?? DEFAULT_MODEL,
        max_tokens: 1500,
        temperature: 0.3,
        system: [
          { type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } },
          {
            type: 'text',
            text: 'Available tools:\n' + JSON.stringify(toolsForClaude),
            cache_control: { type: 'ephemeral' },
          },
        ],
        tools: toolsForClaude,
        messages,
      }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return (await res.json()) as ClaudeResponse;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function executeToolCall(
  registry: ToolDefinition[],
  name: string,
  input: Record<string, unknown>,
  session: ToolSession,
): Promise<{ result: unknown; isError: boolean }> {
  const tool = registry.find((t) => t.name === name);
  if (!tool) {
    return { result: { error: `unknown_tool:${name}` }, isError: true };
  }
  try {
    const validated = tool.inputSchema.parse(input);
    const out = await tool.handler(validated, session);
    return { result: out, isError: false };
  } catch (err) {
    return {
      result: { error: (err as Error).message ?? 'tool_failed' },
      isError: true,
    };
  }
}

export async function runAssistantTurn(args: RunAssistantTurnInput): Promise<AssistantTurnResult> {
  const { conversationId, voiceUrl, session, tools, history, persist, onChunk } = args;

  // 1. STT if voice provided.
  let userText = args.userMessage ?? '';
  if (voiceUrl && !userText) {
    userText = await transcribeAudio(voiceUrl, session.locale);
  }
  if (!userText) {
    return {
      finalText: '',
      toolCalls: [],
      totalUsage: { input: 0, output: 0, cached: 0, cacheCreation: 0 },
      costPkr: 0,
    };
  }

  await persist.saveMessage({
    conversationId,
    role: 'user',
    content: userText,
    voiceUrl,
  });

  const systemPrompt = buildSystemPrompt(session);
  const claudeTools = toClaudeTools(tools);
  const messages: ClaudeMessage[] = [
    ...history,
    { role: 'user', content: [{ type: 'text', text: userText }] },
  ];

  const totalUsage = { input: 0, output: 0, cached: 0, cacheCreation: 0 };
  const toolCallLog: AssistantTurnResult['toolCalls'] = [];
  let finalText = '';

  for (let iter = 0; iter < MAX_TOOL_ITERATIONS; iter += 1) {
    const resp = await callClaude(messages, systemPrompt, claudeTools);
    if (!resp) {
      finalText = 'I could not reach the model right now. Please try again.';
      break;
    }

    totalUsage.input += resp.usage.input_tokens;
    totalUsage.output += resp.usage.output_tokens;
    totalUsage.cached += resp.usage.cache_read_input_tokens ?? 0;
    totalUsage.cacheCreation += resp.usage.cache_creation_input_tokens ?? 0;

    // Push the assistant turn into the running message list.
    messages.push({ role: 'assistant', content: resp.content });

    if (resp.stop_reason !== 'tool_use') {
      const textBlock = resp.content.find((b): b is { type: 'text'; text: string } => b.type === 'text');
      finalText = textBlock?.text ?? '';
      if (onChunk && finalText) onChunk(finalText);
      break;
    }

    // Tool use loop.
    const toolUses = resp.content.filter(
      (b): b is { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> } =>
        b.type === 'tool_use',
    );
    const toolResultBlocks: ContentBlock[] = [];
    for (const call of toolUses) {
      const { result, isError } = await executeToolCall(tools, call.name, call.input, session);
      toolCallLog.push({ name: call.name, input: call.input, result });
      toolResultBlocks.push({
        type: 'tool_result',
        tool_use_id: call.id,
        content: JSON.stringify(result),
        is_error: isError,
      });
      await persist.saveMessage({
        conversationId,
        role: 'tool',
        content: call.name,
        toolCalls: call.input,
        toolResults: result,
      });
    }
    messages.push({ role: 'user', content: toolResultBlocks });
  }

  const costPkr = estimateCostPkr(totalUsage);
  await persist.saveMessage({
    conversationId,
    role: 'assistant',
    content: finalText,
    tokensInput: totalUsage.input,
    tokensOutput: totalUsage.output,
    cachedTokens: totalUsage.cached,
  });
  await persist.bumpConversationUsage(
    conversationId,
    totalUsage.input + totalUsage.output,
    costPkr,
  );

  return { finalText, toolCalls: toolCallLog, totalUsage, costPkr };
}
