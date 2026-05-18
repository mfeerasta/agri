import { adminClient, type TrackedIds } from './db';
import { seedUser, type SeededUser } from './auth';

export interface SeededEntity {
  entityId: string;
  farmId: string;
  blockId: string;
  fieldIds: string[];
  tractorIds: string[];
  fuelTankId: string;
  director: SeededUser;
  farmManager: SeededUser;
  supervisors: SeededUser[];
  workers: SeededUser[];
}

/**
 * Seeds a fresh entity tree for one spec. Every row is tagged with the
 * tracker's e2e tag so cleanup() can find and delete it.
 */
export async function seedMinimalEntity(tracker: TrackedIds): Promise<SeededEntity> {
  const db = adminClient();
  const tag = tracker.tag;

  const [entity] = await db
    .from('entities')
    .insert({ code: `${tag}-ent`, name: `Pilot ${tag}`, locale: 'ur' })
    .select('id')
    .throwOnError();
  const entityId = (entity as { id: string }).id;
  tracker.entityIds.push(entityId);

  const [farm] = await db
    .from('farms')
    .insert({ entity_id: entityId, code: `${tag}-f1`, name: `Farm ${tag}` })
    .select('id')
    .throwOnError();
  const farmId = (farm as { id: string }).id;

  const [block] = await db
    .from('blocks')
    .insert({ farm_id: farmId, code: `${tag}-b1`, name: `Block ${tag}` })
    .select('id')
    .throwOnError();
  const blockId = (block as { id: string }).id;

  const fieldRows = await db
    .from('fields')
    .insert(
      [1, 2, 3, 4].map((i) => ({
        block_id: blockId,
        code: `${tag}-F${i}`,
        name: `Field F${i}`,
        area_acres: 4 + i,
      })),
    )
    .select('id')
    .throwOnError();
  const fieldIds = ((fieldRows as unknown as { id: string }[]) ?? []).map((r) => r.id);

  const tractorRows = await db
    .from('assets')
    .insert(
      [1, 2].map((i) => ({
        entity_id: entityId,
        code: `${tag}-T${i}`,
        kind: 'tractor',
        name: `Tractor ${i}`,
      })),
    )
    .select('id')
    .throwOnError();
  const tractorIds = ((tractorRows as unknown as { id: string }[]) ?? []).map((r) => r.id);

  const [tank] = await db
    .from('fuel_tanks')
    .insert({ entity_id: entityId, code: `${tag}-tank`, capacity_l: 2000, current_l: 1500 })
    .select('id')
    .throwOnError();
  const fuelTankId = (tank as { id: string }).id;

  const director = await seedUser('director', tracker, 'dir');
  const farmManager = await seedUser('farm_manager', tracker, 'fm');
  const supervisors = [
    await seedUser('supervisor', tracker, 's1'),
    await seedUser('supervisor', tracker, 's2'),
  ];
  const workers = [
    await seedUser('worker', tracker, 'w1'),
    await seedUser('worker', tracker, 'w2'),
    await seedUser('worker', tracker, 'w3'),
    await seedUser('worker', tracker, 'w4'),
  ];

  return {
    entityId,
    farmId,
    blockId,
    fieldIds,
    tractorIds,
    fuelTankId,
    director,
    farmManager,
    supervisors,
    workers,
  };
}
