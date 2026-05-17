import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startPg, stopPg, type PgFixture } from './setup.js';

const SHOULD_RUN = process.env.RUN_INT_TESTS === '1';
const d = SHOULD_RUN ? describe : describe.skip;

let pg: PgFixture;
const ENTITY = '00000000-0000-0000-0000-00000000a9b1';
const FIELD = '00000000-0000-0000-0000-000000000f01';
const CROP_PLAN = '00000000-0000-0000-0000-000000000cp1';

d('integration: field P&L from allocations + harvest + mandi', () => {
  beforeAll(async () => {
    pg = await startPg();
    process.env.DATABASE_URL = pg.url;
    await pg.sql`INSERT INTO zameen.entities (id, name) VALUES (${ENTITY}, 'F') ON CONFLICT DO NOTHING`;
    await pg.sql`INSERT INTO zameen.fields (id, entity_id, name, acres) VALUES (${FIELD}, ${ENTITY}, 'F3', 10) ON CONFLICT DO NOTHING`;
    await pg.sql`
      INSERT INTO zameen.crop_plans (id, entity_id, field_id, variety_name, planned_acres)
      VALUES (${CROP_PLAN}, ${ENTITY}, ${FIELD}, 'Wheat', 10)
      ON CONFLICT DO NOTHING
    `;
    await pg.sql`
      INSERT INTO zameen.cost_allocations (entity_id, source_module, source_record_id, cost_pool, amount_pkr, allocated_on, field_id, crop_plan_id)
      VALUES
        (${ENTITY}, 'diesel', gen_random_uuid()::text, 'diesel', 50000, '2026-04-01', ${FIELD}, ${CROP_PLAN}),
        (${ENTITY}, 'input', gen_random_uuid()::text, 'fertilizer', 75000, '2026-04-10', ${FIELD}, ${CROP_PLAN})
    `;
    await pg.sql`
      INSERT INTO zameen.harvest_records (entity_id, field_id, crop_plan_id, harvested_on, gross_yield_kg)
      VALUES (${ENTITY}, ${FIELD}, ${CROP_PLAN}, '2026-05-01', 12000)
    `;
    await pg.sql`
      INSERT INTO zameen.mandi_settlements (entity_id, approval_request_id, settled_on, gross_receipt_pkr, net_received_pkr)
      VALUES (${ENTITY}, ${CROP_PLAN}, '2026-05-05', 600000, 575000)
    `;
  }, 120_000);

  afterAll(async () => {
    if (pg) await stopPg(pg);
  });

  it('computeFieldPnL returns revenue, total cost, gross margin', async () => {
    const { computeFieldPnL } = await import('@zameen/finance');
    const pnl = await computeFieldPnL(CROP_PLAN);
    expect(pnl).not.toBeNull();
    expect(pnl!.revenuePkr).toBe(575000);
    expect(pnl!.totalCostPkr).toBe(125000);
    expect(pnl!.grossMarginPkr).toBe(450000);
    expect(pnl!.yieldKg).toBe(12000);
    expect(pnl!.acres).toBe(10);
  });
});
