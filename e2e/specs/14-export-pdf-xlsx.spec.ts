import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import { cleanup, newTracker } from '../helpers/db';
import { seedMinimalEntity } from '../helpers/seed';
import { signInDirector } from '../helpers/auth';

test.describe('Reports: seasonal PDF and XLSX export', () => {
  const tracker = newTracker();
  test.afterAll(async () => {
    await cleanup(tracker);
  });

  test('director downloads PDF and XLSX with valid contents', async ({ page }) => {
    const seed = await seedMinimalEntity(tracker);
    await signInDirector(page, seed.director);
    await page.goto('/app/finance/reports');
    await page.getByLabel(/season|year/i).selectOption({ label: /2025/ });
    await page.getByRole('button', { name: /generate report/i }).click();
    await expect(page.getByText(/report ready/i)).toBeVisible();

    const [pdf] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: /download.*pdf/i }).click(),
    ]);
    const pdfPath = await pdf.path();
    expect(pdfPath).toBeTruthy();
    if (pdfPath) {
      const buf = await fs.readFile(pdfPath);
      expect(buf.subarray(0, 4).toString('utf8')).toBe('%PDF');
    }

    const [xlsx] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: /download.*xlsx|excel/i }).click(),
    ]);
    const xlsxPath = await xlsx.path();
    expect(xlsxPath).toBeTruthy();
    if (xlsxPath) {
      const buf = await fs.readFile(xlsxPath);
      // XLSX is a zip; magic bytes PK\x03\x04
      expect(buf[0]).toBe(0x50);
      expect(buf[1]).toBe(0x4b);
      expect(buf.length).toBeGreaterThan(500);
    }
  });
});
