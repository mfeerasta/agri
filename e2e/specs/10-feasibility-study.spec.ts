import { test, expect } from '@playwright/test';
import { cleanup, newTracker, adminClient } from '../helpers/db';
import { seedMinimalEntity } from '../helpers/seed';
import { signInDirector, signInFarmManager } from '../helpers/auth';
import { pollUntil } from '../helpers/wait';

test.describe('Feasibility study: draft, edit, approval, executed', () => {
  const tracker = newTracker();
  test.afterAll(async () => {
    await cleanup(tracker);
  });

  test('FM drafts and submits, director approves on approve PWA', async ({ browser }) => {
    const seed = await seedMinimalEntity(tracker);
    const title = `Switch F2 to maize ${tracker.tag}`;

    const fmCtx = await browser.newContext();
    const fmPage = await fmCtx.newPage();
    await signInFarmManager(fmPage, seed.farmManager);
    await fmPage.goto('/app/feasibilities/new');
    await fmPage.getByLabel(/title|name/i).fill(title);
    await fmPage.getByLabel(/brief|description/i).fill('Switch wheat to maize for 2026 kharif');
    await fmPage.getByRole('button', { name: /generate draft/i }).click();
    await expect(fmPage.getByText(/draft generated|ready/i)).toBeVisible({ timeout: 30_000 });
    await fmPage.getByLabel(/projected revenue/i).fill('420000');
    await fmPage.getByRole('button', { name: /submit for approval/i }).click();
    await expect(fmPage.getByRole('status')).toContainText(/submitted/i);
    await fmCtx.close();

    const feas = await pollUntil(async () => {
      const { data } = await adminClient()
        .from('feasibilities')
        .select('id, state')
        .ilike('title', `%${tracker.tag}%`)
        .limit(1);
      return data?.[0] ?? null;
    }, { label: 'feasibility row' });

    const dCtx = await browser.newContext({
      baseURL: process.env.E2E_APPROVE_URL ?? 'http://localhost:3003',
    });
    const dPage = await dCtx.newPage();
    await signInDirector(dPage, seed.director);
    await dPage.goto('/');
    await dPage.getByRole('link', { name: new RegExp(tracker.tag, 'i') }).click();
    await dPage.getByRole('button', { name: /^approve$/i }).click();
    await expect(dPage.getByText(/approved/i)).toBeVisible();
    await dCtx.close();

    const final = await pollUntil(async () => {
      const { data } = await adminClient()
        .from('feasibilities')
        .select('state')
        .eq('id', feas.id)
        .single();
      return data?.state === 'executed' ? data : null;
    }, { label: 'feasibility executed' });
    expect(final.state).toBe('executed');
  });
});
