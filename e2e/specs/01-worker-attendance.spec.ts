import { test, expect } from '@playwright/test';
import { cleanup, newTracker, adminClient } from '../helpers/db';
import { seedMinimalEntity } from '../helpers/seed';
import { signInWorker } from '../helpers/auth';
import { pollUntil } from '../helpers/wait';

test.describe('Field PWA: worker check-in', () => {
  test.use({
    geolocation: { latitude: 31.5497, longitude: 74.3436 },
    permissions: ['geolocation'],
  });

  const tracker = newTracker();
  test.afterAll(async () => {
    await cleanup(tracker);
  });

  test('worker logs in, checks in inside geofence, row written, signs out', async ({ page }) => {
    const seed = await seedMinimalEntity(tracker);
    const worker = seed.workers[0];

    await signInWorker(page, worker);
    await expect(page).toHaveURL(/\/(app)?\/?$|\/home/);

    await page.getByRole('button', { name: /check ?in|haazri|حاضری/i }).click();
    await expect(
      page.getByRole('status').filter({ hasText: /checked in|saved|success/i }),
    ).toBeVisible();

    const row = await pollUntil(async () => {
      const { data } = await adminClient()
        .from('attendance')
        .select('id, gps_lat, gps_lng')
        .eq('user_id', worker.id)
        .limit(1);
      return data?.[0] ?? null;
    }, { label: 'attendance row' });

    expect(row.gps_lat).toBeCloseTo(31.5497, 1);
    expect(row.gps_lng).toBeCloseTo(74.3436, 1);

    await page.getByRole('button', { name: /sign out|log out|لاگ آؤٹ/i }).click();
    await expect(page).toHaveURL(/\/login/);
  });
});
