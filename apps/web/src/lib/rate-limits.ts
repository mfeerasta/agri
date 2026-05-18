/**
 * Re-export the canonical per-route rate-limit policy from @zameen/shared.
 * Kept as its own module so the web app can override a single bucket
 * without forking the whole shape later.
 */
export {
  RATE_LIMITS,
  withRateLimit,
  identityFromRequest,
  type RateLimitConfig,
  type RateLimitKind,
} from '@zameen/shared';
