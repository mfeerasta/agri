import { sql as drizzleSql } from 'drizzle-orm';
import { db } from '@zameen/db';

/**
 * Generates 60 days of realistic Rabi 2025-26 demo data for one entity.
 * All inserts go through raw SQL so we do not need to know the column
 * shape statically. Every row is tagged is_demo = true.
 *
 * Designed to be idempotent-ish: if you load twice you'll get duplicate
 * rows, but clearDemoData wipes them by the flag.
 */
export async function seedDemoData(entityId: string, _runnerUserId: string): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  const today = new Date();
  const days: string[] = [];
  for (let i = 60; i > 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }

  // Pull fields and assets for this entity so we have realistic FKs.
  const fieldsRes = await db.execute(drizzleSql.raw(
    `select f.id, f.code from zameen.fields f
     join zameen.blocks b on b.id = f.block_id
     join zameen.farms fa on fa.id = b.farm_id
     where fa.entity_id = '${entityId}' order by f.code limit 8`,
  ));
  const fieldRows = (fieldsRes as unknown as { id: string; code: string }[]) ?? [];
  const assetsRes = await db.execute(drizzleSql.raw(
    `select id from zameen.assets where entity_id = '${entityId}' and kind = 'tractor' limit 2`,
  ));
  const assetRows = (assetsRes as unknown as { id: string }[]) ?? [];

  // 1. Attendance: 22 workers per day, 90% present. We just create
  // synthetic worker placeholders by reusing existing workers if any.
  const workersRes = await db.execute(drizzleSql.raw(
    `select id from zameen.workers where entity_id = '${entityId}' limit 22`,
  ));
  const workerRows = (workersRes as unknown as { id: string }[]) ?? [];
  let attN = 0;
  for (const day of days) {
    for (const w of workerRows) {
      const r = Math.random();
      const status = r < 0.9 ? 'present' : r < 0.95 ? 'late' : 'absent';
      try {
        await db.execute(drizzleSql.raw(
          `insert into zameen.attendance_records (entity_id, worker_id, attendance_date, status, is_demo)
           values ('${entityId}', '${w.id}', '${day}', '${status}', true)`,
        ));
        attN++;
      } catch {
        // Schema mismatch tolerated; demo is best-effort.
      }
    }
  }
  counts.attendance_records = attN;

  // 2. Diesel daily logs: 30 logs across 2 tractors
  let dieselLogN = 0;
  for (let i = 0; i < 30 && assetRows.length > 0; i++) {
    const asset = assetRows[i % assetRows.length]!;
    const day = days[i * 2 % days.length]!;
    const hours = (4 + Math.random() * 5).toFixed(1);
    const liters = (Number(hours) * 4.2).toFixed(2);
    const rate = '298.00';
    const total = (Number(liters) * Number(rate)).toFixed(2);
    const field = fieldRows[i % Math.max(fieldRows.length, 1)];
    try {
      await db.execute(drizzleSql.raw(
        `insert into zameen.diesel_daily_logs (entity_id, asset_id, log_date, hour_meter_start, hour_meter_end, hours_run, diesel_filled_liters, rate_liter_pkr, total_cost_pkr, task_field_id, task_kind, is_demo)
         values ('${entityId}', '${asset.id}', '${day}', ${1000 + i * 6}, ${1000 + i * 6 + Number(hours)}, ${hours}, ${liters}, ${rate}, ${total}, ${field ? `'${field.id}'` : 'null'}, 'tillage', true)`,
      ));
      dieselLogN++;
    } catch {
      // skip
    }
  }
  counts.diesel_daily_logs = dieselLogN;

  // 3. Diesel purchases: 5 across 60 days
  let purchN = 0;
  for (let i = 0; i < 5; i++) {
    const day = days[i * 12]!;
    const liters = (400 + Math.random() * 400).toFixed(2);
    const rate = '298.00';
    const total = (Number(liters) * Number(rate)).toFixed(2);
    try {
      await db.execute(drizzleSql.raw(
        `insert into zameen.diesel_purchases (entity_id, purchased_at, vendor_name, quantity_liters, rate_liter_pkr, total_pkr, payment_method, receipt_photo_urls, is_demo)
         values ('${entityId}', '${day}T10:00:00Z', 'PSO Renala Khurd', ${liters}, ${rate}, ${total}, 'cash', '["https://placehold.co/600x400/png"]'::jsonb, true)`,
      ));
      purchN++;
    } catch {
      // skip
    }
  }
  counts.diesel_purchases = purchN;

  // 4. Harvest records: 4 on F1-F4 wheat
  let harvN = 0;
  for (let i = 0; i < Math.min(4, fieldRows.length); i++) {
    const f = fieldRows[i]!;
    const day = days[55 + i] ?? days[days.length - 1]!;
    const weight = (1800 + Math.random() * 800).toFixed(2);
    try {
      await db.execute(drizzleSql.raw(
        `insert into zameen.harvest_records (entity_id, field_id, harvest_date, weight_kg, is_demo)
         values ('${entityId}', '${f.id}', '${day}', ${weight}, true)`,
      ));
      harvN++;
    } catch {
      // skip
    }
  }
  counts.harvest_records = harvN;

  // 5. Repair requests: 2
  let repN = 0;
  for (const status of ['closed', 'awaiting_quotes']) {
    if (assetRows.length === 0) break;
    const a = assetRows[0]!;
    try {
      await db.execute(drizzleSql.raw(
        `insert into zameen.repair_requests (entity_id, asset_id, reported_at, title, description, status, photo_urls, is_demo)
         values ('${entityId}', '${a.id}', now() - interval '20 days', 'Hydraulic leak', 'Slow leak from main cylinder', '${status}', '["https://placehold.co/600x400/png"]'::jsonb, true)`,
      ));
      repN++;
    } catch {
      // skip
    }
  }
  counts.repair_requests = repN;

  // 6. Approval requests: 4 at various states
  let aprN = 0;
  for (const state of ['pending', 'approved', 'rejected', 'pending']) {
    try {
      await db.execute(drizzleSql.raw(
        `insert into zameen.approval_requests (entity_id, approval_type, amount_pkr, state, context_snapshot, is_demo)
         values ('${entityId}', 'diesel_purchase', ${(100000 + Math.random() * 200000).toFixed(2)}, '${state}', '{}'::jsonb, true)`,
      ));
      aprN++;
    } catch {
      // skip
    }
  }
  counts.approval_requests = aprN;

  // 7. Cost allocations: 12 across pools
  let costN = 0;
  const pools = ['diesel', 'fertilizer', 'seed', 'labor_field', 'repairs', 'pesticide'];
  for (let i = 0; i < 12; i++) {
    const f = fieldRows[i % Math.max(fieldRows.length, 1)];
    if (!f) break;
    const pool = pools[i % pools.length]!;
    const day = days[i * 5 % days.length]!;
    const amt = (15000 + Math.random() * 60000).toFixed(2);
    try {
      await db.execute(drizzleSql.raw(
        `insert into zameen.cost_allocations (entity_id, field_id, cost_pool, allocated_on, amount_pkr, source_module, is_demo)
         values ('${entityId}', '${f.id}', '${pool}', '${day}', ${amt}, 'demo', true)`,
      ));
      costN++;
    } catch {
      // skip
    }
  }
  counts.cost_allocations = costN;

  // 8. Milk records: 3 records/day for 10 animals across 60 days
  const animalsRes = await db.execute(drizzleSql.raw(
    `select id from zameen.animals where entity_id = '${entityId}' limit 10`,
  ));
  const animalRows = (animalsRes as unknown as { id: string }[]) ?? [];
  let milkN = 0;
  for (const day of days) {
    for (const a of animalRows) {
      for (const session of ['morning', 'evening', 'night']) {
        const liters = (4 + Math.random() * 6).toFixed(2);
        try {
          await db.execute(drizzleSql.raw(
            `insert into zameen.milk_records (entity_id, animal_id, recorded_on, session, liters, is_demo)
             values ('${entityId}', '${a.id}', '${day}', '${session}', ${liters}, true)`,
          ));
          milkN++;
        } catch {
          // skip
        }
      }
    }
  }
  counts.milk_records = milkN;

  // 9. Task completions: 8 piece-rate logs
  let taskN = 0;
  for (let i = 0; i < 8; i++) {
    if (workerRows.length === 0) break;
    const w = workerRows[i % workerRows.length]!;
    const day = days[i * 7 % days.length]!;
    try {
      await db.execute(drizzleSql.raw(
        `insert into zameen.task_completions (entity_id, worker_id, completed_on, task_kind, quantity, unit, rate_pkr, is_demo)
         values ('${entityId}', '${w.id}', '${day}', 'cotton_picking', ${(40 + Math.random() * 30).toFixed(2)}, 'kg', 25.00, true)`,
      ));
      taskN++;
    } catch {
      // skip
    }
  }
  counts.task_completions = taskN;

  return counts;
}
