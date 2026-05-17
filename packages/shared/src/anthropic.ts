/**
 * Anthropic Claude client for narrative AI across Zameen.
 *
 * Three call shapes:
 *   - complete: single-shot, returns full text + usage
 *   - stream:  async generator yielding deltas (SSE-friendly)
 *
 * Defaults:
 *   model:       env ZAMEEN_CLAUDE_MODEL or claude-3-5-sonnet-20241022
 *   timeout:     60s
 *   temperature: 0.4
 *   maxTokens:   1024
 *
 * On missing key or upstream failure, complete() returns a degraded result
 * with empty text + usage zero so callers can fall back gracefully. stream()
 * yields { delta: '', done: true } in the same case.
 *
 * No em-dashes in returned text: every system prompt should remind Claude.
 */

const DEFAULT_MODEL = 'claude-3-5-sonnet-20241022';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const TIMEOUT_MS = 60_000;
const ANTHROPIC_VERSION = '2023-06-01';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface CompleteArgs {
  system: string;
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
  cacheKey?: string;
  model?: string;
}

export interface CompleteResult {
  text: string;
  stopReason: string;
  usage: { input: number; output: number };
}

export interface StreamChunk {
  delta: string;
  done: boolean;
}

function getModel(model?: string): string {
  return model ?? process.env.ZAMEEN_CLAUDE_MODEL ?? DEFAULT_MODEL;
}

function getApiKey(): string | null {
  return process.env.ANTHROPIC_API_KEY ?? null;
}

interface AnthropicCompleteBody {
  model: string;
  max_tokens: number;
  temperature: number;
  system: Array<{ type: 'text'; text: string; cache_control?: { type: 'ephemeral' } }>;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  stream?: boolean;
}

function buildBody(args: CompleteArgs, stream: boolean): AnthropicCompleteBody {
  const systemBlock: AnthropicCompleteBody['system'][number] = {
    type: 'text',
    text: args.system,
  };
  if (args.cacheKey) {
    systemBlock.cache_control = { type: 'ephemeral' };
  }
  return {
    model: getModel(args.model),
    max_tokens: args.maxTokens ?? 1024,
    temperature: args.temperature ?? 0.4,
    system: [systemBlock],
    messages: args.messages.map((m) => ({ role: m.role, content: m.content })),
    stream,
  };
}

interface AnthropicCompleteResponse {
  content?: Array<{ type: string; text?: string }>;
  stop_reason?: string;
  usage?: { input_tokens?: number; output_tokens?: number };
  error?: { message?: string };
}

export async function complete(args: CompleteArgs): Promise<CompleteResult> {
  const key = getApiKey();
  if (!key) {
    return { text: '', stopReason: 'no_api_key', usage: { input: 0, output: 0 } };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify(buildBody(args, false)),
      signal: controller.signal,
    });
    if (!res.ok) {
      return { text: '', stopReason: `http_${res.status}`, usage: { input: 0, output: 0 } };
    }
    const json = (await res.json()) as AnthropicCompleteResponse;
    const textBlock = (json.content ?? []).find((b) => b.type === 'text');
    const text = textBlock?.text ?? '';
    return {
      text,
      stopReason: json.stop_reason ?? 'end_turn',
      usage: {
        input: json.usage?.input_tokens ?? 0,
        output: json.usage?.output_tokens ?? 0,
      },
    };
  } catch {
    return { text: '', stopReason: 'timeout_or_error', usage: { input: 0, output: 0 } };
  } finally {
    clearTimeout(timer);
  }
}

interface SseEvent {
  event: string;
  data: string;
}

function parseSseBlock(raw: string): SseEvent | null {
  const lines = raw.split('\n');
  let event = '';
  let data = '';
  for (const line of lines) {
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) data += line.slice(5).trim();
  }
  if (!event && !data) return null;
  return { event, data };
}

export async function* stream(args: CompleteArgs): AsyncGenerator<StreamChunk> {
  const key = getApiKey();
  if (!key) {
    yield { delta: '', done: true };
    return;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify(buildBody(args, true)),
      signal: controller.signal,
    });
    if (!res.ok || !res.body) {
      yield { delta: '', done: true };
      return;
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const blocks = buf.split('\n\n');
      buf = blocks.pop() ?? '';
      for (const block of blocks) {
        const evt = parseSseBlock(block);
        if (!evt) continue;
        if (evt.event === 'content_block_delta') {
          try {
            const parsed = JSON.parse(evt.data) as {
              delta?: { type?: string; text?: string };
            };
            const txt = parsed.delta?.type === 'text_delta' ? parsed.delta.text ?? '' : '';
            if (txt) yield { delta: txt, done: false };
          } catch {
            // ignore malformed
          }
        } else if (evt.event === 'message_stop') {
          yield { delta: '', done: true };
        }
      }
    }
    yield { delta: '', done: true };
  } catch {
    yield { delta: '', done: true };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Build a system prompt suffix that reminds Claude of Zameen's house style.
 * Append to every system prompt that returns text shown to MF.
 */
export const HOUSE_STYLE = [
  'Style rules:',
  '- Never use em-dashes (use a comma or period instead).',
  '- Be concise. No preamble like "Sure, here is".',
  '- Use plain English. Urdu or Roman Urdu is fine when quoting source text.',
  '- All currency is PKR.',
].join('\n');
