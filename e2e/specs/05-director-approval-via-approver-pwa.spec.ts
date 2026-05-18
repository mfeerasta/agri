import { test, expect } from '@playwright/test';
import { cleanup, newTracker, adminClient } from '../helpers/db';
import { seedMinimalEntity } from '../helpers/seed';
import { signInDirector, signInFarmManager } from '../helpers/auth';
import { pollUntil } from '../helpers/wait';

test.describe('Approver PWA: director approves Rs 150k (over FM cap)', () => {
  test.use({
    geolocation: { latitude: 31.5497, longitude: 74.3436 },
    permissions: ['geolocation'],
  });

  const tracker = newTracker();
  test.afterAll(async () => {
    await cleanup(tracker);
  });

  test('FM submits, director sees context, approves with GPS captured', async ({ browser }) => {
    const seed = await seedMinimalEntity(tracker);

    // FM submits against the web app (different baseURL than this project's approve PWA).
    const webCtx = await browser.newContext({
      baseURL: process.env.E2E_WEB_URL ?? 'http://localhost:3000',
    });
    const webPage = await webCtx.newPage();
    await signInFarmManager(webPage, seed.farmManager);
    await webPage.goto('/inputs/purchase');
    await webPage.getByLabel(/title|description|item/i).fill(`Bulk DAP ${tracker.tag}`);
    await webPage.getByLabel(/amount|cost|total/i).fill('150000');
    await webPage.getByRole('button', { name: /submit|create/i }).click();
    await expect(webPage.getByRole('status')).toContainText(/submitted|saved/i);
    await webCtx.close();

    const req = await pollUntil(async () => {
      const { data } = await adminClient()
        .from('approval_requests')
        .select('id, required_role, state')
        .ilike('context_snapshot->>title', `%${tracker.tag}%`)
        .limit(1);
      return data?.[0] ?? null;
    }, { label: 'request created' });
    expect(req.required_role).toBe('director');

    // Director uses approver PWA (this project's baseURL).
    const dirCtx = await browser.newContext({
      permissions: ['geolocation'],
      geolocation: { latitude: 31.5497, longitude: 74.3436 },
    });
    const dirPage = await dirCtx.newPage();
    await signInDirector(dirPage, seed.director);
    await dirPage.goto('/');
    await dirPage.getByRole('link', { name: new RegExp(tracker.tag, 'i') }).click();
    await expect(dirPage.getByText(/cash position/i)).toBeVisible();
    await expect(dirPage.getByText(/threshold|policy/i)).toBeVisible();
    await dirPage.getByRole('button', { name: /^approve$/i }).click();
    await expect(dirPage.getByText(/approved/i)).toBeVisible();

    const action = await pollUntil(async () => {
      const { data } = await adminClient()
        .from('approval_actions')
        .select('actor_id, gps_lat, gps_lng, decision')
        .eq('request_id', req.id)
        .eq('decision', 'approved')
        .limit(1);
      return data?.[0] ?? null;
    }, { label: 'approval_actions' });
    expect(action.gps_lat).toBeCloseTo(31.5497, 1);
    expect(action.actor_id).toBe(seed.director.id);

    await dirCtx.close();
  });
});
