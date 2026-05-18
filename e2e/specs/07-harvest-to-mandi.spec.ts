import { test, expect } from '@playwright/test';
import { cleanup, newTracker, adminClient } from '../helpers/db';
import { seedMinimalEntity } from '../helpers/seed';
import { signInFarmManager, signInSupervisor, signInWorker } from '../helpers/auth';
import { pollUntil } from '../helpers/wait';

test.describe('Harvest to mandi: F3 wheat lot, storage move, dispatch, settlement', () => {
  const tracker = newTracker();
  test.afterAll(async () => {
    await cleanup(tracker);
  });

  test('produce lot flows through storage, dispatch, settlement with revenue posting', async ({
    browser,
  }) => {
    const seed = await seedMinimalEntity(tracker);

    const wCtx = await browser.newContext({
      baseURL: process.env.E2E_FIELD_URL ?? 'http://localhost:3001',
    });
    const wPage = await wCtx.newPage();
    await signInWorker(wPage, seed.workers[0]);
    await wPage.goto('/harvest/new');
    await wPage.getByLabel(/field/i).selectOption({ label: /F3/i });
    await wPage.getByLabel(/crop|variety/i).selectOption({ label: /wheat/i });
    await wPage.getByLabel(/area|acres/i).fill('4');
    await wPage.getByLabel(/gross yield|weight|kg/i).fill('800');
    await wPage.getByLabel(/moisture/i).fill('12');
    await wPage.getByRole('button', { name: /save|submit/i }).click();
    await expect(wPage.getByRole('status')).toContainText(/saved|created/i);
    await wCtx.close();

    const lot = await pollUntil(async () => {
      const { data } = await adminClient()
        .from('produce_lots')
        .select('id, qty_kg, crop')
        .eq('entity_id', seed.entityId)
        .limit(1);
      return data?.[0] ?? null;
    }, { label: 'produce_lots' });
    expect(Number(lot.qty_kg)).toBe(800);

    const sCtx = await browser.newContext();
    const sPage = await sCtx.newPage();
    await signInSupervisor(sPage, seed.supervisors[0]);
    await sPage.goto(`/inventory/produce/${lot.id}`);
    await sPage.getByRole('button', { name: /move to storage/i }).click();
    await sPage.getByLabel(/location/i).selectOption({ index: 1 });
    await sPage.getByRole('button', { name: /confirm|save/i }).click();
    await expect(sPage.getByText(/in storage|stored/i)).toBeVisible();
    await sCtx.close();

    const fmCtx = await browser.newContext();
    const fmPage = await fmCtx.newPage();
    await signInFarmManager(fmPage, seed.farmManager);
    await fmPage.goto(`/inventory/produce/${lot.id}`);
    await fmPage.getByRole('button', { name: /dispatch to mandi/i }).click();
    await fmPage.getByLabel(/mandi|market/i).fill('Lahore Mandi');
    await fmPage.getByLabel(/qty|weight/i).fill('800');
    await fmPage.getByRole('button', { name: /confirm|create/i }).click();

    await fmPage.getByRole('button', { name: /record settlement/i }).click();
    await fmPage.getByLabel(/gross.*amount/i).fill('60000');
    await fmPage.getByLabel(/commission/i).fill('2000');
    await fmPage.getByLabel(/labour|loading/i).fill('500');
    await fmPage.getByRole('button', { name: /save settlement|post/i }).click();
    await expect(fmPage.getByText(/settled|recorded/i)).toBeVisible();
    await fmCtx.close();

    const journal = await pollUntil(async () => {
      const { data } = await adminClient()
        .from('journals')
        .select('id, kind')
        .eq('entity_id', seed.entityId)
        .eq('kind', 'revenue')
        .limit(1);
      return data?.[0] ?? null;
    }, { label: 'revenue journal' });
    expect(journal).toBeTruthy();
  });
});
