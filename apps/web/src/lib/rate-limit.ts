/**
 * Backwards-compatible shim. The real implementation now lives in
 * `@zameen/shared/rate-limit` and is backed by the database so limits
 * survive across Node processes on Hetzner. Existing callers keep
 * working unchanged.
 */

export { rateLimit } from '@zameen/shared';
export { consume } from '@zameen/shared';
export type { ConsumeResult } from '@zameen/shared';
