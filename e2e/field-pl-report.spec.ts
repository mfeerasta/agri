import { test, expect } from '@playwright/test';
import { seedUser, signIn } from './helpers/auth.js';

test.describe('Web: field P&L report', () => {
  test('opens /finance, runs season report, sees P&L table', async ({ page }) => {
    const director = await seedUser('director', '-pl');
    await signIn(page, director);
    await page.goto('/finance');
    await page.getByRole('link', { name: /field p[/&]?l|p&l/i }).click();
    await page.getByLabel(/season|year/i).selectOption({ index: 1 });
    await page.getByRole('button', { name: /run|generate/i }).click();
    await expect(page.getByRole('table')).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /margin/i })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /revenue/i })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /cost/i })).toBeVisible();
  });
});
