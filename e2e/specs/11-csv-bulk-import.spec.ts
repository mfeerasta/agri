import { test, expect } from '@playwright/test';
import path from 'node:path';
import { cleanup, newTracker, adminClient } from '../helpers/db';
import { seedMinimalEntity } from '../helpers/seed';
import { signInDirector } from '../helpers/auth';

test.describe('Admin: CSV bulk import of workers', () => {
  const tracker = newTracker();
  test.afterAll(async () => {
    await cleanup(tracker);
  });

  test('director uploads CSV, maps columns, 5 worker rows inserted', async ({ page }) => {
    const seed = await seedMinimalEntity(tracker);
    await signInDirector(page, seed.director);
    await page.goto('/app/admin/import/workers');

    await page
      .getByLabel(/csv file|upload/i)
      .setInputFiles(path.join(__dirname, '..', 'fixtures', 'workers-import.csv'));
    await page.getByRole('button', { name: /next|preview/i }).click();

    // Column mapping form
    await page.getByLabel(/^code$/i).selectOption({ label: /code/i });
    await page.getByLabel(/^name$/i).selectOption({ label: /name/i });
    await page.getByLabel(/^phone$/i).selectOption({ label: /phone/i });

    await page.getByRole('button', { name: /commit|import/i }).click();
    await expect(page.getByText(/5\s+(rows|workers).*imported/i)).toBeVisible();

    const { data } = await adminClient()
      .from('workers')
      .select('id, code, name')
      .like('code', `${tracker.tag}%`);
    expect((data ?? []).length).toBe(5);
  });
});
