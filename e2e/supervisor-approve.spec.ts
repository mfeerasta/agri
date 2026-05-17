import { test, expect } from '@playwright/test';
import { seedUser, signIn } from './helpers/auth.js';

test.describe('Web: supervisor approves Rs 8k repair', () => {
  test('submit Rs 8k repair, supervisor approves, state becomes executed', async ({ page }) => {
    const supervisor = await seedUser('supervisor', '-rep');
    await signIn(page, supervisor);

    await page.goto('/repairs/new');
    await page.getByLabel(/title|description/i).fill('Fix tractor brake');
    await page.getByLabel(/amount|cost/i).fill('8000');
    await page.getByRole('button', { name: /submit|create/i }).click();

    await page.goto('/approvals');
    await page.getByRole('link', { name: /fix tractor brake/i }).click();
    await page.getByRole('button', { name: /^approve$/i }).click();
    await expect(page.getByText(/approved|executed/i)).toBeVisible();

    await page.getByRole('button', { name: /execute|mark executed/i }).click();
    await expect(page.getByText(/executed/i)).toBeVisible();
  });
});
