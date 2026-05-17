import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Page } from '@playwright/test';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://localhost:54321';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

export interface SeededUser {
  email: string;
  password: string;
  id: string;
  role: 'director' | 'farm_manager' | 'supervisor' | 'worker';
}

export function adminClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function seedUser(role: SeededUser['role'], suffix = ''): Promise<SeededUser> {
  const admin = adminClient();
  const email = `e2e-${role}${suffix}-${Date.now()}@example.com`;
  const password = 'Pa55word!Test';
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role },
  });
  if (error || !data.user) throw error ?? new Error('seedUser failed');
  return { email, password, id: data.user.id, role };
}

export async function signIn(page: Page, user: SeededUser): Promise<void> {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(user.email);
  await page.getByLabel(/password/i).fill(user.password);
  await page.getByRole('button', { name: /sign in|login|log in/i }).click();
  await page.waitForURL((url) => !url.pathname.includes('/login'));
}

export { SUPABASE_URL, ANON_KEY };
