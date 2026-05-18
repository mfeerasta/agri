import { test, expect } from '@playwright/test';
import { cleanup, newTracker, adminClient } from '../helpers/db';
import { seedMinimalEntity } from '../helpers/seed';
import { signInFarmManager } from '../helpers/auth';
import { pollUntil } from '../helpers/wait';

test.describe('Approval: Rs 75k fertilizer routes to farm_manager', () => {
  const tracker = newTracker();
  test.afterAll(async () => {
    await cleanup(tracker);
  });

  test('farm manager submits and approves within their threshold', async ({ page }) => {
    const seed = await seedMinimalEntity(tracker);
    await signInFarmManager(page, seed.farmManager);

    await page.goto('/inputs/purchase');
    await page.getByLabel(/title|description|item/i).fill(`NPK 200 bags ${tracker.tag}`);
    await page.getByLabel(/amount|cost|total/i).fill('75000');
    await page.getByRole('button', { name: /submit|create/i }).click();
    await expect(page.getByRole('status')).toContainText(/submitted|saved/i);

    const req = await pollUntil(async () => {
      const { data } = await adminClient()
        .from('approval_requests')
        .select('id, state, required_role')
        .ilike('context_snapshot->>title', `%${tracker.tag}%`)
        .limit(1);
      return data?.[0] ?? null;
    }, { label: 'approval_requests' });
    expect(req.required_role).toBe('farm_manager');

    await page.goto('/app/approvals');
    await page.getByRole('link', { name: new RegExp(tracker.tag, 'i') }).click();
    await page.getByRole('button', { name: /^approve$/i }).click();
    await expect(page.getByText(/approved|executed/i)).toBeVisible();
  });
});
