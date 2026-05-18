import { test, expect } from '@playwright/test';
import { cleanup, newTracker, adminClient } from '../helpers/db';
import { seedMinimalEntity } from '../helpers/seed';
import { signInWorker } from '../helpers/auth';
import { pollUntil } from '../helpers/wait';

test.describe('Field PWA: offline queue drains when network returns', () => {
  test.use({
    geolocation: { latitude: 31.5497, longitude: 74.3436 },
    permissions: ['geolocation'],
  });

  const tracker = newTracker();
  test.afterAll(async () => {
    await cleanup(tracker);
  });

  test('attendance + diesel queued offline, flushed online', async ({ page, context }) => {
    const seed = await seedMinimalEntity(tracker);
    await signInWorker(page, seed.workers[0]);

    await context.setOffline(true);

    await page.getByRole('button', { name: /check ?in|haazri|حاضری/i }).click();
    await page.goto('/diesel/log');
    await page.getByLabel(/asset|tractor/i).selectOption({ index: 1 });
    await page.getByLabel(/liters|litres/i).fill('10');
    await page.getByLabel(/rate/i).fill('280');
    await page.getByRole('button', { name: /save|submit/i }).click();

    const pending = await page.evaluate(async () => {
      const dbReq = indexedDB.open('zameen-offline');
      return await new Promise<number>((resolve) => {
        dbReq.onsuccess = () => {
          const db = dbReq.result;
          const tx = db.transaction('queue', 'readonly');
          const store = tx.objectStore('queue');
          const countReq = store.count();
          countReq.onsuccess = () => resolve(countReq.result);
          countReq.onerror = () => resolve(-1);
        };
        dbReq.onerror = () => resolve(-1);
      });
    });
    expect(pending).toBeGreaterThanOrEqual(2);

    await context.setOffline(false);

    await pollUntil(async () => {
      const remaining = await page.evaluate(async () => {
        const dbReq = indexedDB.open('zameen-offline');
        return await new Promise<number>((resolve) => {
          dbReq.onsuccess = () => {
            const db = dbReq.result;
            const tx = db.transaction('queue', 'readonly');
            const store = tx.objectStore('queue');
            const countReq = store.count();
            countReq.onsuccess = () => resolve(countReq.result);
            countReq.onerror = () => resolve(-1);
          };
        });
      });
      return remaining === 0 ? true : null;
    }, { label: 'queue drained', timeoutMs: 30_000 });

    const att = await adminClient()
      .from('attendance')
      .select('id')
      .eq('user_id', seed.workers[0].id);
    expect((att.data ?? []).length).toBeGreaterThanOrEqual(1);

    const log = await adminClient()
      .from('diesel_daily_logs')
      .select('id')
      .eq('user_id', seed.workers[0].id);
    expect((log.data ?? []).length).toBeGreaterThanOrEqual(1);
  });
});
