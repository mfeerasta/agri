import { test, expect } from '@playwright/test';
import path from 'node:path';
import { cleanup, newTracker } from '../helpers/db';
import { seedMinimalEntity } from '../helpers/seed';
import { signInWorker } from '../helpers/auth';

const skipUnlessOcr = process.env.OPENAI_API_KEY ? test : test.skip;

test.describe('Diesel: OCR autofill from receipt photo', () => {
  const tracker = newTracker();
  test.afterAll(async () => {
    await cleanup(tracker);
  });

  skipUnlessOcr('known receipt fixture autofills liters + rate within tolerance', async ({
    page,
  }) => {
    const seed = await seedMinimalEntity(tracker);
    await signInWorker(page, seed.workers[0]);
    await page.goto('/diesel/purchase');

    await page
      .getByLabel(/receipt|photo/i)
      .setInputFiles(path.join(__dirname, '..', 'fixtures', 'receipt-diesel.jpg'));

    await expect(page.getByText(/scanning|reading receipt/i)).toBeVisible();
    await expect(page.getByText(/scanned|done/i)).toBeVisible({ timeout: 30_000 });

    const liters = await page.getByLabel(/liters|litres/i).inputValue();
    const rate = await page.getByLabel(/rate/i).inputValue();
    expect(Number(liters)).toBeGreaterThan(0);
    expect(Number(rate)).toBeGreaterThan(0);
    expect(Number(liters)).toBeLessThan(500);
    expect(Number(rate)).toBeLessThan(2000);
  });
});
