import { test, expect } from '@playwright/test';
import path from 'node:path';
import { cleanup, newTracker, adminClient } from '../helpers/db';
import { seedMinimalEntity } from '../helpers/seed';
import { signInSupervisor, signInWorker } from '../helpers/auth';
import { pollUntil } from '../helpers/wait';

test.describe('Approval: Rs 18k diesel routes to supervisor', () => {
  const tracker = newTracker();
  test.afterAll(async () => {
    await cleanup(tracker);
  });

  test('worker submits, supervisor approves, journal posted', async ({ browser }) => {
    const seed = await seedMinimalEntity(tracker);

    const workerCtx = await browser.newContext();
    const workerPage = await workerCtx.newPage();
    await signInWorker(workerPage, seed.workers[0]);
    await workerPage.goto('/diesel/purchase');
    await workerPage.getByLabel(/amount|cost|total/i).fill('18000');
    await workerPage.getByLabel(/liters|litres/i).fill('64');
    await workerPage
      .getByLabel(/receipt|photo/i)
      .setInputFiles(path.join(__dirname, '..', 'fixtures', 'receipt-diesel.jpg'));
    await workerPage.getByRole('button', { name: /submit|create/i }).click();
    await expect(workerPage.getByRole('status')).toContainText(/submitted|saved/i);

    const purchase = await pollUntil(async () => {
      const { data } = await adminClient()
        .from('diesel_purchases')
        .select('id, state, approval_request_id')
        .eq('created_by', seed.workers[0].id)
        .limit(1);
      return data?.[0] ?? null;
    }, { label: 'diesel_purchases row' });

    const supCtx = await browser.newContext();
    const supPage = await supCtx.newPage();
    await signInSupervisor(supPage, seed.supervisors[0]);
    await supPage.goto('/app/approvals');
    await supPage
      .getByRole('row', { name: new RegExp('18,?000') })
      .getByRole('link', { name: /view|open/i })
      .click();
    await supPage.getByRole('button', { name: /^approve$/i }).click();
    await expect(supPage.getByText(/approved|executed/i)).toBeVisible();

    const final = await pollUntil(async () => {
      const { data } = await adminClient()
        .from('approval_requests')
        .select('state')
        .eq('id', purchase.approval_request_id)
        .single();
      return data?.state === 'executed' ? data : null;
    }, { label: 'approval executed' });
    expect(final.state).toBe('executed');

    const journals = await adminClient()
      .from('journals')
      .select('id')
      .eq('source_record_id', purchase.id);
    expect((journals.data ?? []).length).toBeGreaterThan(0);

    await workerCtx.close();
    await supCtx.close();
  });
});
