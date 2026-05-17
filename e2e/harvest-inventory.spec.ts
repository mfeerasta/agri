import { test, expect } from '@playwright/test';
import { seedUser, signIn } from './helpers/auth.js';

test.describe('Field PWA: harvest logging creates produce lot + cost allocations', () => {
  test('log harvest from F3 wheat', async ({ page }) => {
    const worker = await seedUser('worker', '-hv');
    await signIn(page, worker);
    await page.goto('/harvest/new');
    await page.getByLabel(/field/i).selectOption({ label: /F3/i });
    await page.getByLabel(/crop|variety/i).selectOption({ label: /wheat/i });
    await page.getByLabel(/gross yield|yield kg|weight/i).fill('12000');
    await page.getByRole('button', { name: /save|submit/i }).click();

    await expect(page.getByRole('status').filter({ hasText: /saved|created/i })).toBeVisible();
    await page.goto('/inventory/produce');
    await expect(page.getByText(/wheat/i)).toBeVisible();
    await expect(page.getByText(/12,?000/)).toBeVisible();
  });
});
