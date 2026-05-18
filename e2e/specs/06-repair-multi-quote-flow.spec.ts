import { test, expect } from '@playwright/test';
import path from 'node:path';
import { cleanup, newTracker, adminClient } from '../helpers/db';
import { seedMinimalEntity } from '../helpers/seed';
import { signInDirector, signInFarmManager, signInWorker } from '../helpers/auth';
import { pollUntil } from '../helpers/wait';

test.describe('Repair lifecycle: request, quotes, approval, work order, closure', () => {
  test.use({
    geolocation: { latitude: 31.5497, longitude: 74.3436 },
    permissions: ['geolocation'],
  });

  const tracker = newTracker();
  test.afterAll(async () => {
    await cleanup(tracker);
  });

  test('full repair flow ends with closed work order and operator sign-off', async ({ browser }) => {
    const seed = await seedMinimalEntity(tracker);
    const title = `Brake fix ${tracker.tag}`;

    // 1. Worker reports repair with photo on field PWA.
    const wCtx = await browser.newContext({
      baseURL: process.env.E2E_FIELD_URL ?? 'http://localhost:3001',
    });
    const wPage = await wCtx.newPage();
    await signInWorker(wPage, seed.workers[0]);
    await wPage.goto('/repairs/new');
    await wPage.getByLabel(/title|describe|issue/i).fill(title);
    await wPage.getByLabel(/asset|tractor/i).selectOption({ index: 1 });
    await wPage
      .getByLabel(/photo|evidence/i)
      .setInputFiles(path.join(__dirname, '..', 'fixtures', 'receipt-repair.jpg'));
    await wPage.getByRole('button', { name: /submit|save/i }).click();
    await expect(wPage.getByRole('status')).toContainText(/submitted|saved/i);
    await wCtx.close();

    const repair = await pollUntil(async () => {
      const { data } = await adminClient()
        .from('repair_requests')
        .select('id')
        .ilike('title', `%${tracker.tag}%`)
        .limit(1);
      return data?.[0] ?? null;
    }, { label: 'repair_requests' });

    // 2. Farm manager adds two quotes, picks the cheaper.
    const fmCtx = await browser.newContext({
      baseURL: process.env.E2E_WEB_URL ?? 'http://localhost:3000',
    });
    const fmPage = await fmCtx.newPage();
    await signInFarmManager(fmPage, seed.farmManager);
    await fmPage.goto(`/repairs/${repair.id}`);
    await fmPage.getByRole('button', { name: /add quote/i }).click();
    await fmPage.getByLabel(/vendor/i).fill('Vendor A');
    await fmPage.getByLabel(/amount|price/i).fill('60000');
    await fmPage.getByRole('button', { name: /save/i }).click();

    await fmPage.getByRole('button', { name: /add quote/i }).click();
    await fmPage.getByLabel(/vendor/i).fill('Vendor B');
    await fmPage.getByLabel(/amount|price/i).fill('48000');
    await fmPage.getByRole('button', { name: /save/i }).click();

    await fmPage
      .getByRole('row', { name: /vendor b/i })
      .getByRole('button', { name: /select|choose/i })
      .click();
    await fmPage.getByLabel(/reason/i).selectOption({ label: /cheapest/i });
    await fmPage.getByRole('button', { name: /confirm|submit for approval/i }).click();
    await fmCtx.close();

    // 3. Director approves on approve PWA (this project's baseURL).
    const dCtx = await browser.newContext({
      permissions: ['geolocation'],
      geolocation: { latitude: 31.5497, longitude: 74.3436 },
    });
    const dPage = await dCtx.newPage();
    await signInDirector(dPage, seed.director);
    await dPage.goto('/');
    await dPage.getByRole('link', { name: new RegExp(tracker.tag, 'i') }).click();
    await dPage.getByRole('button', { name: /^approve$/i }).click();
    await expect(dPage.getByText(/approved/i)).toBeVisible();
    await dCtx.close();

    const wo = await pollUntil(async () => {
      const { data } = await adminClient()
        .from('repair_work_orders')
        .select('id, state')
        .eq('repair_request_id', repair.id)
        .limit(1);
      return data?.[0] ?? null;
    }, { label: 'work order created' });
    expect(wo.state).toMatch(/open|in_progress/);

    // 4. Close work order with invoice + operator sign-off.
    const closeCtx = await browser.newContext({
      baseURL: process.env.E2E_WEB_URL ?? 'http://localhost:3000',
    });
    const closePage = await closeCtx.newPage();
    await signInFarmManager(closePage, seed.farmManager);
    await closePage.goto(`/repairs/${repair.id}`);
    await closePage.getByRole('button', { name: /close|complete/i }).click();
    await closePage.getByLabel(/final invoice|amount/i).fill('48000');
    await closePage
      .getByLabel(/invoice photo|receipt/i)
      .setInputFiles(path.join(__dirname, '..', 'fixtures', 'receipt-repair.jpg'));
    await closePage.getByLabel(/operator|sign[- ]off/i).fill('Aslam');
    await closePage.getByLabel(/warranty.*days?/i).fill('30');
    await closePage.getByRole('button', { name: /confirm|close work order/i }).click();
    await expect(closePage.getByText(/closed|completed/i)).toBeVisible();
    await closeCtx.close();
  });
});
