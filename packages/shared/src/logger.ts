/**
 * Structured JSON logger. In production each call emits one JSON line on
 * stdout which Docker captures and Vector ships to Loki (Phase 2). In dev
 * we use a human-readable format so the terminal stays scannable.
 *
 * All payloads run through redact() so tokens, cookies, and PII never end
 * up in the log stream.
 */
import { safeStringify, redact } from './redact.js';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  level: LogLevel;
  scope: string;
  message: string;
  meta?: Record<string, unknown>;
  occurredAt: string;
}

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

export function log(
  level: LogLevel,
  scope: string,
  message: string,
  meta?: Record<string, unknown>,
): void {
  const entry: LogEntry = {
    level,
    scope,
    message,
    meta,
    occurredAt: new Date().toISOString(),
  };
  if (isProduction()) {
    process.stdout.write(safeStringify(entry) + '\n');
    return;
  }
  const tail = meta ? ' ' + safeStringify(redact(meta)) : '';
  process.stdout.write(`[${level}] [${scope}] ${message}${tail}\n`);
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
