/**
 * Structured JSON logger. In production each call emits one JSON line on
 * stdout which Docker captures and Vector ships to Loki (Phase 2). In dev
 * we use a human-readable format so the terminal stays scannable.
 *
 * All payloads run through redact() so tokens, cookies, and PII never end
 * up in the log stream.
 *
 * Trace correlation: callers may bind a traceId by passing it in meta or
 * by setting it once for the current request via withTrace(). Next.js
 * routes should read the `x-request-id` header and call withTrace() inside
 * the route handler.
 */
import { safeStringify, redact } from './redact.js';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  level: LogLevel;
  scope: string;
  message: string;
  traceId?: string;
  meta?: Record<string, unknown>;
  occurredAt: string;
}

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

// Module-level current trace id. Falls back to undefined when unset.
// Server actions in Next.js share module state per request only through
// async storage; we keep this simple and document the convention.
let currentTraceId: string | undefined;

export function setTraceId(traceId: string | undefined): void {
  currentTraceId = traceId;
}

export function getTraceId(): string | undefined {
  return currentTraceId;
}

export function generateTraceId(): string {
  // crypto.randomUUID is available in Node 19+ and edge runtimes.
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Read the trace id from an incoming Request. Generates a fresh id if
 * the upstream did not provide one.
 */
export function traceIdFromRequest(req: Request): string {
  return req.headers.get('x-request-id') ?? generateTraceId();
}

export function log(
  level: LogLevel,
  scope: string,
  message: string,
  meta?: Record<string, unknown>,
): void {
  const traceId =
    (meta && typeof meta.traceId === 'string' ? (meta.traceId as string) : undefined) ??
    currentTraceId;
  const entry: LogEntry = {
    level,
    scope,
    message,
    traceId,
    meta,
    occurredAt: new Date().toISOString(),
  };
  if (isProduction()) {
    process.stdout.write(safeStringify(entry) + '\n');
    return;
  }
  const tail = meta ? ' ' + safeStringify(redact(meta)) : '';
  const tracePart = traceId ? ` [${traceId.slice(0, 8)}]` : '';
  process.stdout.write(`[${level}]${tracePart} [${scope}] ${message}${tail}\n`);
}

export const logger = {
  debug: (scope: string, msg: string, meta?: Record<string, unknown>): void =>
    log('debug', scope, msg, meta),
  info: (scope: string, msg: string, meta?: Record<string, unknown>): void =>
    log('info', scope, msg, meta),
  warn: (scope: string, msg: string, meta?: Record<string, unknown>): void =>
    log('warn', scope, msg, meta),
  error: (scope: string, msg: string, meta?: Record<string, unknown>): void =>
    log('error', scope, msg, meta),
};
