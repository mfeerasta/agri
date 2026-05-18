import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://localhost:54321';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

export function adminClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    db: { schema: 'zameen' as never },
  });
}

export function publicAdmin(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function randomSuffix(): string {
  return randomBytes(4).toString('hex');
}

export function testTag(): string {
  return `e2e-${randomSuffix()}`;
}

export interface TrackedIds {
  userIds: string[];
  entityIds: string[];
  tag: string;
}

export function newTracker(): TrackedIds {
  return { userIds: [], entityIds: [], tag: testTag() };
}

/**
 * Best-effort teardown. Deletes auth users + any rows whose code/name carries
 * the test tag. Safe to call multiple times.
 */
export async function cleanup(tracker: TrackedIds): Promise<void> {
  const pub = publicAdmin();
  for (const uid of tracker.userIds) {
    try {
      await pub.auth.admin.deleteUser(uid);
    } catch {
      // ignore
    }
  }

  const admin = adminClient();
  // Cascade order: child rows first, then entity.
  const tables = [
    'approval_actions',
    'approval_requests',
    'journal_lines',
    'journals',
    'cost_allocations',
    'diesel_daily_logs',
    'diesel_purchases',
    'diesel_stock_recons',
    'repair_invoices',
    'repair_work_orders',
    'repair_quotes',
    'repair_requests',
    'harvest_records',
    'produce_lots',
    'mandi_dispatches',
    'feasibilities',
    'automation_runs',
    'notifications',
    'attendance',
    'workers',
    'fields',
    'blocks',
    'farms',
    'entities',
  ];
  for (const t of tables) {
    try {
      await admin.from(t).delete().like('code', `${tracker.tag}%`);
      await admin.from(t).delete().like('name', `%${tracker.tag}%`);
    } catch {
      // ignore: not every table has these columns
    }
  }
}
