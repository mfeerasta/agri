/**
 * Public-facing error class. Anything thrown that is NOT a PublicError will
 * be flattened to a generic message by `toUserMessage`, preventing internal
 * stack traces or DB errors from reaching the client.
 */
export class PublicError extends Error {
  constructor(
    public override message: string,
    public statusCode = 400,
    public code?: string,
  ) {
    super(message);
    this.name = 'PublicError';
  }
}

export function toUserMessage(err: unknown): string {
  if (err instanceof PublicError) return err.message;
  return 'Something went wrong. Please try again or contact support.';
}

export function errorStatus(err: unknown): number {
  return err instanceof PublicError ? err.statusCode : 500;
}
