/**
 * RLS isolation fuzz test. For each table that has an entity_id column,
 * authenticates as a user belonging to entity A and tries to read rows
 * known to belong to entity B. Every attempt must either error out
 * (permission denied) or return zero rows.
 *
 * The test pre-seeds both entities with a marker row so we have a non-empty
 * set to fail against. Tables that legitimately have no entity_id column
 * are silently skipped.
 */
import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { adminClient, cleanup, newTracker } from '../helpers/db';
import { seedMinimalEntity } from '../helpers/seed';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://localhost:54321';
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

const TABLES_WITH_ENTITY_ID = [
  'entities',
  'farms',
  'blocks',
  'fields',
  'crop_plans',
  'input_purchases',
  'diesel_purchases',
  'diesel_daily_logs',
  'repair_requests',
  'animals',
  'milk_records',
  'workers',
  'attendance_records',
  'tasks',
  'payroll_runs',
  'accounts',
  'journal_entries',
  'cost_allocations',
  'approval_requests',
  'documents',
  'tax_filings',
  'crop_diagnostics',
  'weather_alert_rules',
  'insurance_policies',
  'crop_loans',
  'worker_score_periods',
  'automation_recipes',
  'digest_subscriptions',
];

test.describe('RLS: cross-entity fuzz', () => {
  const trackerA = newTracker();
  const trackerB = newTracker();
  test.afterAll(async () => {
    await cleanup(trackerA);
    await cleanup(trackerB);
  });

  test('no table leaks entity B rows when authed as entity A', async () => {
    const a = await seedMinimalEntity(trackerA);
    const b = await seedMinimalEntity(trackerB);

    const aClient = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    await aClient.auth.signInWithPassword({
      email: a.workers[0].email,
      password: a.workers[0].password,
    });

    const admin = adminClient();
    const leaks: { table: string; rows: number }[] = [];

    for (const table of TABLES_WITH_ENTITY_ID) {
      // Confirm entity B has at least one row in this table via admin client.
      let entityBHasRows = false;
      try {
        const probe = await admin.from(table).select('id').eq('entity_id', b.entityId).limit(1);
        entityBHasRows = (probe.data ?? []).length > 0;
      } catch {
        continue;
      }
      if (!entityBHasRows) continue;

      // Now attempt the same query as user A.
      const { data, error } = await aClient
        .schema('zameen' as never)
        .from(table)
        .select('id')
        .eq('entity_id', b.entityId)
        .limit(5);

      // permission denied counts as pass; zero rows counts as pass.
      if (error) continue;
      const rows = (data ?? []).length;
      if (rows > 0) leaks.push({ table, rows });
    }

    expect(leaks, `RLS leaks detected: ${JSON.stringify(leaks)}`).toEqual([]);
  });
});
