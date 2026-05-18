import { test, expect } from '@playwright/test';
import { cleanup, newTracker, adminClient } from '../helpers/db';
import { seedMinimalEntity } from '../helpers/seed';
import { signInDirector } from '../helpers/auth';
import { pollUntil } from '../helpers/wait';
import fs from 'node:fs/promises';

test.describe('Finance: per-field P&L renders and exports PDF', () => {
  const tracker = newTracker();
  test.afterAll(async () => {
    await cleanup(tracker);
  });

  test('seeded crop plan with allocations renders revenue, cost-by-pool, margins', async ({
    page,
  }) => {
    const seed = await seedMinimalEntity(tracker);
    const db = adminClient();
    const fieldId = seed.fieldIds[0];

    // Crop plan + cost allocations + revenue settlement seeded directly.
    const [plan] = await db
      .from('crop_plans')
      .insert({
        entity_id: seed.entityId,
        field_id: fieldId,
        crop: 'wheat',
        season: '2025-rabi',
        target_yield_kg: 4000,
      })
      .select('id')
      .throwOnError();
    const planId = (plan as { id: string }).id;

    await db
      .from('cost_allocations')
      .insert([
        { crop_plan_id: planId, field_id: fieldId, cost_pool: 'diesel', amount_pkr: 12000 },
        { crop_plan_id: planId, field_id: fieldId, cost_pool: 'fertilizer', amount_pkr: 45000 },
        { crop_plan_id: planId, field_id: fieldId, cost_pool: 'labour', amount_pkr: 18000 },
      ])
      .throwOnError();

    await db
      .from('revenue_entries')
      .insert({ crop_plan_id: planId, field_id: fieldId, amount_pkr: 130000 })
      .throwOnError();

    await signInDirector(page, seed.director);
    await page.goto('/app/finance/field-pnl');
    await page.getByLabel(/season|year/i).selectOption({ label: /2025/ });
    await page.getByRole('button', { name: /run|generate/i }).click();

    const row = page.getByRole('row', { name: new RegExp(`${tracker.tag}.*F1`, 'i') });
    await expect(row.getByText(/130,?000/)).toBeVisible();
    await expect(row.getByText(/75,?000/)).toBeVisible(); // 12k + 45k + 18k
    await expect(row.getByText(/55,?000/)).toBeVisible(); // gross margin

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: /export.*pdf/i }).click(),
    ]);
    const file = await download.path();
    expect(file).toBeTruthy();
    expect(download.suggestedFilename()).toMatch(/F1.*\.pdf$/i);
    if (file) {
      const stat = await fs.stat(file);
      expect(stat.size).toBeGreaterThan(100);
    }

    // Ensure computeFieldPnL view stays in sync.
    const pnl = await pollUntil(async () => {
      const { data } = await db
        .from('field_pnl_view')
        .select('revenue_pkr, total_cost_pkr')
        .eq('crop_plan_id', planId)
        .limit(1);
      return data?.[0] ?? null;
    }, { label: 'pnl view' });
    expect(Number(pnl.revenue_pkr)).toBe(130000);
    expect(Number(pnl.total_cost_pkr)).toBe(75000);
  });
});
