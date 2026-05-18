import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Page } from '@playwright/test';
import { adminClient, publicAdmin, randomSuffix, type TrackedIds } from './db';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://localhost:54321';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

export type Role = 'director' | 'farm_manager' | 'supervisor' | 'worker';

export interface SeededUser {
  email: string;
  phone: string;
  password: string;
  id: string;
  role: Role;
}

export function admin(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function pkPhone(): string {
  const n = String(Math.floor(100_000_000 + Math.random() * 899_999_999));
  return `+923${n.slice(0, 9)}`;
}

export async function seedUser(
  role: Role,
  tracker: TrackedIds,
  suffix = '',
): Promise<SeededUser> {
  const a = admin();
  const tag = `${tracker.tag}-${role}${suffix}-${randomSuffix()}`;
  const email = `${tag}@example.com`;
  const phone = pkPhone();
  const password = 'Pa55word!Test';
  const { data, error } = await a.auth.admin.createUser({
    email,
    phone,
    password,
    email_confirm: true,
    phone_confirm: true,
    user_metadata: { role, e2e_tag: tracker.tag },
  });
  if (error || !data.user) throw error ?? new Error('seedUser failed');
  tracker.userIds.push(data.user.id);
  try {
    await adminClient()
      .from('user_profiles')
      .upsert({ user_id: data.user.id, role, full_name: tag });
  } catch {
    // user_profiles may not exist in some environments; safe to ignore
  }
  return { email, phone, password, id: data.user.id, role };
}

async function loginViaMagicLink(page: Page, user: SeededUser): Promise<void> {
  const a = admin();
  const { data, error } = await a.auth.admin.generateLink({
    type: 'magiclink',
    email: user.email,
  });
  if (error || !data.properties?.action_link) {
    // Fall back to UI password login if magic-link generation is disabled.
    await signInWithPassword(page, user);
    return;
  }
  await page.goto(data.properties.action_link);
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 20_000 });
}

export async function signInWorker(page: Page, user: SeededUser): Promise<void> {
  await loginViaMagicLink(page, user);
}

export async function signInSupervisor(page: Page, user: SeededUser): Promise<void> {
  await loginViaMagicLink(page, user);
}

export async function signInFarmManager(page: Page, user: SeededUser): Promise<void> {
  await loginViaMagicLink(page, user);
}

export async function signInDirector(page: Page, user: SeededUser): Promise<void> {
  await loginViaMagicLink(page, user);
}

export async function signInWithPassword(page: Page, user: SeededUser): Promise<void> {
  await page.goto('/login');
  const phoneField = page.getByLabel(/phone/i);
  if (await phoneField.isVisible().catch(() => false)) {
    await phoneField.fill(user.phone);
    await page.getByRole('button', { name: /send/i }).click();
    const token = await fetchLatestOtp(user.phone);
    await page.getByLabel(/otp|code/i).fill(token);
    await page.getByRole('button', { name: /verify/i }).click();
  } else {
    await page.getByLabel(/email/i).fill(user.email);
    await page.getByLabel(/password/i).fill(user.password);
    await page.getByRole('button', { name: /sign in|log in|login/i }).click();
  }
  await page.waitForURL((url) => !url.pathname.includes('/login'));
}

async function fetchLatestOtp(phone: string): Promise<string> {
  const fixed = process.env.SUPABASE_AUTH_TEST_OTP;
  if (fixed) return fixed;
  const pub = publicAdmin();
  const { data } = await pub
    .schema('auth' as never)
    .from('one_time_tokens')
    .select('token_hash')
    .eq('phone', phone)
    .order('created_at', { ascending: false })
    .limit(1);
  return (data?.[0]?.token_hash as string | undefined) ?? '000000';
}

export { SUPABASE_URL, ANON_KEY };
