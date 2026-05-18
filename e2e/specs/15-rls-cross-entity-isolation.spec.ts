import { test, expect, request } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { cleanup, newTracker } from '../helpers/db';
import { seedMinimalEntity } from '../helpers/seed';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://localhost:54321';
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

test.describe('RLS: cross-entity isolation', () => {
  const trackerA = newTracker();
  const trackerB = newTracker();
  test.afterAll(async () => {
    await cleanup(trackerA);
    await cleanup(trackerB);
  });

  test('user from entity A cannot see entity B rows via API or UI', async ({ baseURL }) => {
    const a = await seedMinimalEntity(trackerA);
    const b = await seedMinimalEntity(trackerB);

    // Authenticate as entity A worker against Supabase directly with anon key.
    const aClient = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    await aClient.auth.signInWithPassword({
      email: a.workers[0].email,
      password: a.workers[0].password,
    });

    const { data: ownFields } = await aClient
      .schema('zameen' as never)
      .from('fields')
      .select('id, code');
    expect((ownFields ?? []).every((f) => f.code.startsWith(trackerA.tag))).toBe(true);
    expect((ownFields ?? []).some((f) => f.code.startsWith(trackerB.tag))).toBe(false);

    const { data: leak } = await aClient
      .schema('zameen' as never)
      .from('fields')
      .select('id')
      .in('id', b.fieldIds);
    expect(leak ?? []).toHaveLength(0);

    // Direct UI hit: entity B's field detail should 404 or be redirected.
    const ctx = await request.newContext({ baseURL });
    const res = await ctx.get(`/app/fields/${b.fieldIds[0]}`);
    expect([401, 403, 404]).toContain(res.status());
  });
});
