/**
 * POST /api/sync
 *
 * Receives one QueuedOp at a time from the field-PWA offline queue and
 * dispatches it to the same engines used by the web app. Idempotent via a
 * client-generated key stored in zameen.idempotency_log.
 */
import { NextResponse } from 'next/server';
import { sql } from '@zameen/db';
import { getFieldSession } from '../../../lib/session';
import { dispatch, type DispatchResult } from '../../../server/sync-dispatcher';
import { assertSameOrigin, CsrfError } from '../../../lib/csrf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface QueuedBody {
  resource?: string;
  operation?: 'insert' | 'update' | 'delete' | 'attach_photo';
  payload?: Record<string, unknown>;
  clientCreatedAt?: string;
  idempotencyKey?: string;
}

async function lookupIdempotent(key: string): Promise<DispatchResult | null> {
  const rows = (await sql`
    select response from zameen.idempotency_log where idempotency_key = ${key} limit 1
  `) as Array<{ response: DispatchResult }>;
  return rows[0]?.response ?? null;
}

async function recordIdempotent(key: string, userId: string, response: DispatchResult): Promise<void> {
  await sql`
    insert into zameen.idempotency_log (idempotency_key, user_id, response)
    values (${key}, ${userId}, ${sql.json(response)})
    on conflict (idempotency_key) do nothing
  `;
}

export async function POST(req: Request): Promise<Response> {
  try {
    assertSameOrigin(req);
  } catch (error) {
    if (error instanceof CsrfError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
    }
    throw error;
  }
  const session = await getFieldSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  }

  let body: QueuedBody;
  try {
    body = (await req.json()) as QueuedBody;
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const { resource, operation, payload, idempotencyKey } = body;
  if (!resource || !operation || !payload) {
    return NextResponse.json({ ok: false, error: 'resource, operation and payload required' }, { status: 400 });
  }

  const headerKey = req.headers.get('x-idempotency-key') ?? undefined;
  const key = idempotencyKey ?? headerKey;

  if (key) {
    const cached = await lookupIdempotent(key);
    if (cached) return NextResponse.json(cached);
  }

  const result = await dispatch(resource, operation, payload, {
    userId: session.userId,
    entityId: session.entityId,
    role: session.role,
  });

  if (key && result.ok) {
    await recordIdempotent(key, session.userId, result);
  }

  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
