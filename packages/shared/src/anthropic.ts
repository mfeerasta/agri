/**
 * Anthropic Claude client for narrative AI across Zameen.
 *
 * Three call shapes:
 *   - complete: single-shot, returns full text + usage
 *   - stream:  async generator yielding deltas (SSE-friendly)
 *
 * Prompt caching: pass `cacheSystem: true` (or `cacheKey`) to tag the system
 * block with `cache_control: { type: 'ephemeral' }`. Pass `cachedReferences`
 * to attach large static blocks (disease libraries, vocab) that also get
 * cached. The `cacheControl` option is an alias that accepts a list of
 * cached reference strings inline; it is wired by the high-volume call
 * sites listed below. Cache hits cost roughly 10% of normal input tokens.
 *
 * Wired sites (Anthropic prompt caching enabled):
 *   1. WhatsApp NLU (nlu.ts) - system + intent grammar
 *   2. Crop diagnostics (crop-diagnose.ts) - system + crop profile
 *   3. Cash-flow narrative (digests/builders.ts) - CoA + recent journals
 *   4. Spray planner (spray-planner.ts) - label library
 *   5. Approval-context summarizer (digests/builders.ts) - entity policy
 *
 * Defaults:
 *   model:       env ZAMEEN_CLAUDE_MODEL or claude-3-5-sonnet-20241022
 *   timeout:     60s
 *   temperature: 0.4
 *   maxTokens:   1024
 *
 * On missing key or upstream failure, complete() returns a degraded result
 * with empty text and zero usage so callers can fall back gracefully.
 * stream() yields { delta: '', done: true } in the same case.
 *
 * No em-dashes in returned text: every system prompt should remind Claude.
 */

const DEFAULT_MODEL = 'claude-3-5-sonnet-20241022';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const TIMEOUT_MS = 60_000;
const ANTHROPIC_VERSION = '2023-06-01';

// Pricing for Claude Sonnet 4 family, in USD per million tokens.
// Cached input is ~10% of base. Cache write is ~125% of base.
// Source: anthropic.com/pricing. Update if a new tier ships.
const PRICE_INPUT_USD_PER_M = 3;
const PRICE_OUTPUT_USD_PER_M = 15;
const PRICE_CACHED_INPUT_USD_PER_M = 0.3;
const PRICE_CACHE_WRITE_USD_PER_M = 3.75;
const USD_TO_PKR = 280;

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface CompleteArgs {
  system: string;
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
  /** Marks the system block as cacheable (90% discount on hit). */
  cacheKey?: string;
  /** Same effect as cacheKey but more readable at call sites. */
  cacheSystem?: boolean;
  /**
   * Extra static text blocks (disease libs, vocab, etc.) appended after the
   * system block. Each block is sent as its own content part with
   * cache_control so the gateway caches it independently.
   */
  cachedReferences?: string[];
  /**
   * Explicit per-call cache control. When provided, the system block and
   * every reference block are tagged ephemeral. Useful at call sites that
   * want to opt into caching by config rather than by flag.
   */
  cacheControl?: {
    system?: boolean;
    references?: string[];
  };
  model?: string;
}

export interface CompleteResult {
  text: string;
  stopReason: string;
  usage: {
    input: number;
    output: number;
    cached: number;
    cacheCreation: number;
  };
  costEstimatePkr: number;
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

interface SystemBlock {
  type: 'text';
  text: string;
  cache_control?: { type: 'ephemeral' };
}

interface AnthropicCompleteBody {
  model: string;
  max_tokens: number;
  temperature: number;
  system: SystemBlock[];
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  stream?: boolean;
}

function buildSystem(args: CompleteArgs): SystemBlock[] {
  const cacheSystem =
    Boolean(args.cacheSystem || args.cacheKey) || Boolean(args.cacheControl?.system);
  const blocks: SystemBlock[] = [{ type: 'text', text: args.system }];
  if (cacheSystem) {
    blocks[0].cache_control = { type: 'ephemeral' };
  }
  const refs = [...(args.cachedReferences ?? []), ...(args.cacheControl?.references ?? [])];
  for (const ref of refs) {
    blocks.push({ type: 'text', text: ref, cache_control: { type: 'ephemeral' } });
  }
  return blocks;
}

function buildBody(args: CompleteArgs, stream: boolean): AnthropicCompleteBody {
  return {
    model: getModel(args.model),
    max_tokens: args.maxTokens ?? 1024,
    temperature: args.temperature ?? 0.4,
    system: buildSystem(args),
    messages: args.messages.map((m) => ({ role: m.role, content: m.content })),
    stream,
  };
}

/**
 * Estimate PKR cost from a usage breakdown. Fresh input is billed at the
 * standard rate, cache hits at 10%, cache creation at 125%, output at
 * standard. Safe to call client-side because it's pure math.
 */
export function estimateCostPkr(usage: {
  input: number;
  output: number;
  cached: number;
  cacheCreation: number;
}): number {
  const usd =
    (usage.input * PRICE_INPUT_USD_PER_M +
      usage.output * PRICE_OUTPUT_USD_PER_M +
      usage.cached * PRICE_CACHED_INPUT_USD_PER_M +
      usage.cacheCreation * PRICE_CACHE_WRITE_USD_PER_M) /
    1_000_000;
  return Number((usd * USD_TO_PKR).toFixed(4));
}

interface AnthropicCompleteResponse {
  content?: Array<{ type: string; text?: string }>;
  stop_reason?: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  };
  error?: { message?: string };
}

function emptyUsage(): CompleteResult['usage'] {
  return { input: 0, output: 0, cached: 0, cacheCreation: 0 };
}

export async function complete(args: CompleteArgs): Promise<CompleteResult> {
  const key = getApiKey();
  if (!key) {
    return { text: '', stopReason: 'no_api_key', usage: emptyUsage(), costEstimatePkr: 0 };
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
      return { text: '', stopReason: `http_${res.status}`, usage: emptyUsage(), costEstimatePkr: 0 };
    }
    const json = (await res.json()) as AnthropicCompleteResponse;
    const textBlock = (json.content ?? []).find((b) => b.type === 'text');
    const text = textBlock?.text ?? '';
    const usage: CompleteResult['usage'] = {
      input: json.usage?.input_tokens ?? 0,
      output: json.usage?.output_tokens ?? 0,
      cached: json.usage?.cache_read_input_tokens ?? 0,
      cacheCreation: json.usage?.cache_creation_input_tokens ?? 0,
    };
    return {
      text,
      stopReason: json.stop_reason ?? 'end_turn',
      usage,
      costEstimatePkr: estimateCostPkr(usage),
    };
  } catch {
    return { text: '', stopReason: 'timeout_or_error', usage: emptyUsage(), costEstimatePkr: 0 };
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
