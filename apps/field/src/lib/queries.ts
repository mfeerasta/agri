import 'server-only';
import { db, assets, fields, blocks, farms, fuelStorageTanks, inputs, animals } from '@zameen/db';
import { and, eq } from 'drizzle-orm';

export async function listAssets(entityId: string) {
  return db
    .select({ id: assets.id, code: assets.code, make: assets.make, model: assets.model, currentHourMeter: assets.currentHourMeter })
    .from(assets)
    .where(and(eq(assets.entityId, entityId), eq(assets.isActive, true)));
}

export async function listFields(entityId: string) {
  return db
    .select({
      id: fields.id,
      code: fields.code,
      name: fields.name,
      nameUr: fields.nameUr,
      acres: fields.acres,
    })
    .from(fields)
    .innerJoin(blocks, eq(blocks.id, fields.blockId))
    .innerJoin(farms, eq(farms.id, blocks.farmId))
    .where(eq(farms.entityId, entityId));
}

export async function listTanks(entityId: string) {
  return db
    .select({ id: fuelStorageTanks.id, code: fuelStorageTanks.code, capacityLiters: fuelStorageTanks.capacityLiters })
    .from(fuelStorageTanks)
    .where(eq(fuelStorageTanks.entityId, entityId));
}

export async function listInputs(entityId: string) {
  return db
    .select({
      id: inputs.id,
      type: inputs.type,
      name: inputs.name,
      nameUr: inputs.nameUr,
      unit: inputs.unit,
    })
    .from(inputs)
    .where(and(eq(inputs.entityId, entityId), eq(inputs.isActive, true)));
}

export async function listLactatingAnimals(entityId: string) {
  return db
    .select({
      id: animals.id,
      earTag: animals.earTag,
      species: animals.species,
    })
    .from(animals)
    .where(and(eq(animals.entityId, entityId), eq(animals.sex, 'female'), eq(animals.status, 'active')));
}

export async function listActiveAnimals(entityId: string) {
  return db
    .select({
      id: animals.id,
      earTag: animals.earTag,
      species: animals.species,
      sex: animals.sex,
    })
    .from(animals)
    .where(and(eq(animals.entityId, entityId), eq(animals.status, 'active')));
}
