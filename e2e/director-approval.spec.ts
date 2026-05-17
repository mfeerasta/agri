import { test, expect } from '@playwright/test';
import { seedUser, signIn } from './helpers/auth.js';

test.describe('Approve PWA: director approves Rs 75k fertilizer', () => {
  test.use({
    geolocation: { latitude: 31.5497, longitude: 74.3436 },
    permissions: ['geolocation'],
  });

  test('farm manager submits, director sees cash position, approves with GPS', async ({ page }) => {
    const fm = await seedUser('farm_manager', '-fert');
    const director = await seedUser('director', '-fert');

    // FM submits via the web app's API for speed; we focus the e2e on the approve PWA.
    await signIn(page, fm);
    await page.goto('/inputs/purchase');
    await page.getByLabel(/title|description/i).fill('NPK 200 bags');
    await page.getByLabel(/amount|cost/i).fill('75000');
    await page.getByRole('button', { name: /submit|create/i }).click();

    // Switch to approve PWA as director.
    await page.context().clearCookies();
    await signIn(page, director);
    await page.goto('/');
    await page.getByRole('link', { name: /npk 200 bags/i }).click();
    await expect(page.getByText(/cash position/i)).toBeVisible();
    await page.getByRole('button', { name: /^approve$/i }).click();
    await expect(page.getByText(/approved/i)).toBeVisible();
  });
});
