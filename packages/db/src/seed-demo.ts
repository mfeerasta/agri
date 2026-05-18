/**
 * Demo seed: loads 60 days of fake history for the AGRI entity so dashboards
 * have something to show before pilot launch. Rows tagged is_demo = true
 * and a label 'e2e-demo' so clearDemoData can wipe them later.
 *
 * Usage: pnpm db:seed:demo
 */

import { sql as drizzleSql } from 'drizzle-orm';
import { db } from './index.js';

async function main() {
  const entityCode = process.env.DEMO_ENTITY_CODE ?? 'AGRI';
  const rows = await db.execute(drizzleSql.raw(
    `select id from zameen.entities where code = '${entityCode}' limit 1`,
  ));
  const entity = (rows as unknown as { id: string }[])[0];
  if (!entity) {
    console.error(`No entity with code ${entityCode}. Run pnpm db:seed first.`);
    process.exit(1);
  }
  const entityId = entity.id;
  console.log(`Loading demo data for entity ${entityCode} (${entityId})...`);

  await db.execute(drizzleSql.raw(
    `update zameen.entities set is_demo = true where id = '${entityId}'`,
  ));

  const today = new Date();
  const days: string[] = [];
  for (let i = 60; i > 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }

  // diesel purchases: one every ~12 days
  for (let i = 0; i < 5; i++) {
    const day = days[i * 12]!;
    const liters = (400 + Math.random() * 400).toFixed(2);
    const rate = '298.00';
    const total = (Number(liters) * Number(rate)).toFixed(2);
    await db.execute(drizzleSql.raw(
      `insert into zameen.diesel_purchases (entity_id, purchased_at, vendor_name, quantity_liters, rate_liter_pkr, total_pkr, payment_method, receipt_photo_urls, is_demo)
       values ('${entityId}', '${day}T10:00:00Z', 'PSO Renala Khurd', ${liters}, ${rate}, ${total}, 'cash', '["https://placehold.co/600x400/png"]'::jsonb, true)`,
    ));
  }

  console.log('Demo seed complete. Use clearDemoData to remove.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
