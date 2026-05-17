/**
 * Helper for parsing + zod-validating JSON bodies on route handlers.
 * Returns a discriminated union so callers can early-return a 400 response.
 */

import type { ZodSchema } from 'zod';

export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: 400; error: string };

export async function validateBody<T>(req: Request, schema: ZodSchema<T>): Promise<ValidationResult<T>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return { ok: false, status: 400, error: 'invalid_json' };
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues
      .slice(0, 3)
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    return { ok: false, status: 400, error: message || 'invalid_body' };
  }
  return { ok: true, data: parsed.data };
}
