import { test, expect } from '@playwright/test';
import path from 'node:path';
import { cleanup, newTracker, adminClient } from '../helpers/db';
import { seedMinimalEntity } from '../helpers/seed';
import { signInWorker } from '../helpers/auth';
import { pollUntil } from '../helpers/wait';

test.describe('Field PWA: diesel daily log with receipt photo', () => {
  const tracker = newTracker();
  test.afterAll(async () => {
    await cleanup(tracker);
  });

  test('worker fills daily log, cost allocation appears tagged to field', async ({ page }) => {
    const seed = await seedMinimalEntity(tracker);
    const worker = seed.workers[0];

    await signInWorker(page, worker);
    await page.getByRole('link', { name: /diesel|ڈیزل/i }).click();
    await page.getByRole('button', { name: /new log|add log|log diesel/i }).click();

    await page.getByLabel(/asset|tractor/i).selectOption({ index: 1 });
    await page.getByLabel(/operator/i).fill('Aslam');
    await page.getByLabel(/hour meter start/i).fill('1000');
    await page.getByLabel(/hour meter end/i).fill('1008');
    await page.getByLabel(/liters|litres/i).fill('25');
    await page.getByLabel(/rate/i).fill('280');
    await page.getByLabel(/field/i).selectOption({ index: 1 });

    await page
      .getByLabel(/receipt|photo/i)
      .setInputFiles(path.join(__dirname, '..', 'fixtures', 'receipt-diesel.jpg'));

    await page.getByRole('button', { name: /save|submit/i }).click();
    await expect(page.getByRole('status').filter({ hasText: /saved|success/i })).toBeVisible();

    const log = await pollUntil(async () => {
      const { data } = await adminClient()
        .from('diesel_daily_logs')
        .select('id, liters, total_pkr, field_id')
        .eq('user_id', worker.id)
        .limit(1);
      return data?.[0] ?? null;
    }, { label: 'diesel_daily_logs row' });

    expect(Number(log.liters)).toBe(25);
    expect(Number(log.total_pkr)).toBeCloseTo(7000, 0); // 25 * 280

    const alloc = await pollUntil(async () => {
      const { data } = await adminClient()
        .from('cost_allocations')
        .select('id, cost_pool, field_id, amount_pkr')
        .eq('source_record_id', log.id)
        .limit(1);
      return data?.[0] ?? null;
    }, { label: 'cost_allocations row' });

    expect(alloc.cost_pool).toBe('diesel');
    expect(alloc.field_id).toBeTruthy();
  });
});
