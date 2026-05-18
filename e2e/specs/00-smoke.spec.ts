import { test, expect, request } from '@playwright/test';

test.describe('Smoke: page loads and health endpoints', () => {
  test('marketing home returns 200 and shows hero', async ({ page }) => {
    const res = await page.goto('/');
    expect(res?.status()).toBeLessThan(400);
    await expect(page.locator('h1').first()).toBeVisible();
  });

  test('login route returns 200', async ({ page }) => {
    const res = await page.goto('/login');
    expect(res?.status()).toBeLessThan(400);
  });

  test('api/health returns ok', async ({ baseURL }) => {
    const ctx = await request.newContext({ baseURL });
    const res = await ctx.get('/api/health');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  test('all four app shells boot', async () => {
    const urls = [
      process.env.E2E_WEB_URL ?? 'http://localhost:3000',
      process.env.E2E_FIELD_URL ?? 'http://localhost:3001',
      process.env.E2E_OPS_URL ?? 'http://localhost:3002',
      process.env.E2E_APPROVE_URL ?? 'http://localhost:3003',
    ];
    for (const url of urls) {
      const ctx = await request.newContext();
      const res = await ctx.get(url);
      expect(res.status(), `shell at ${url}`).toBeLessThan(500);
    }
  });
});
