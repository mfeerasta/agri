export interface PollOptions {
  timeoutMs?: number;
  intervalMs?: number;
  label?: string;
}

/** Poll an async predicate until it returns a truthy value or the timeout hits. */
export async function pollUntil<T>(
  fn: () => Promise<T | null | undefined | false>,
  opts: PollOptions = {},
): Promise<T> {
  const timeout = opts.timeoutMs ?? 15_000;
  const interval = opts.intervalMs ?? 250;
  const deadline = Date.now() + timeout;
  let lastErr: unknown = null;
  while (Date.now() < deadline) {
    try {
      const v = await fn();
      if (v) return v as T;
    } catch (err) {
      lastErr = err;
    }
    await sleep(interval);
  }
  throw new Error(
    `pollUntil(${opts.label ?? 'predicate'}) timed out after ${timeout}ms${
      lastErr ? `: ${(lastErr as Error).message}` : ''
    }`,
  );
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
