import { test, expect } from '@playwright/test';
import { seedUser, signIn } from './helpers/auth.js';
import path from 'node:path';

test.describe('Field PWA: diesel log', () => {
  test('worker logs diesel for tractor and sees success toast', async ({ page }) => {
    const worker = await seedUser('worker', '-diesel');
    await signIn(page, worker);
    await page.getByRole('link', { name: /diesel/i }).click();
    await page.getByRole('button', { name: /new log|add log|log diesel/i }).click();

    await page.getByLabel(/asset|tractor/i).selectOption({ index: 1 });
    await page.getByLabel(/operator/i).fill('Aslam');
    await page.getByLabel(/hour meter start/i).fill('1000');
    await page.getByLabel(/hour meter end/i).fill('1008');
    await page.getByLabel(/liters|litres/i).fill('25');
    await page.getByLabel(/rate/i).fill('280');

    await page
      .getByLabel(/receipt|photo/i)
      .setInputFiles(path.join(__dirname, 'fixtures', 'receipt.jpg'));

    await page.getByRole('button', { name: /save|submit/i }).click();
    await expect(page.getByRole('status').filter({ hasText: /saved|success/i })).toBeVisible();
    await expect(page.getByText(/aslam/i)).toBeVisible();
  });
});
