import { decimal, jsonb, text, uuid, varchar, date } from 'drizzle-orm/pg-core';
import { zameen } from './_schema.js';
import { entities } from './core.js';
import { animalSexEnum, animalSpeciesEnum } from './enums.js';

export const animals = zameen.table('animals', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id').notNull().references(() => entities.id, { onDelete: 'cascade' }),
  earTag: varchar('ear_tag', { length: 32 }).notNull(),
  species: animalSpeciesEnum('species').notNull(),
  breed: text('breed'),
  sex: animalSexEnum('sex').notNull(),
  dob: date('dob'),
  damEarTag: varchar('dam_ear_tag', { length: 32 }),
  sireEarTag: varchar('sire_ear_tag', { length: 32 }),
  acquisitionDate: date('acquisition_date'),
  acquisitionPricePkr: decimal('acquisition_price_pkr', { precision: 14, scale: 2 }),
  status: varchar('status', { length: 16 }).notNull().default('active'),
  photoUrl: text('photo_url'),
  notes: text('notes'),
});

export const breedingEvents = zameen.table('breeding_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  animalId: uuid('animal_id').notNull().references(() => animals.id, { onDelete: 'cascade' }),
  eventType: varchar('event_type', { length: 24 }).notNull(),
  eventDate: date('event_date').notNull(),
  details: jsonb('details'),
  recordedBy: uuid('recorded_by'),
});

export const milkRecords = zameen.table('milk_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  animalId: uuid('animal_id').notNull().references(() => animals.id, { onDelete: 'cascade' }),
  recordedOn: date('recorded_on').notNull(),
  session: varchar('session', { length: 8 }).notNull(),
  litres: decimal('litres', { precision: 6, scale: 2 }).notNull(),
  fatPct: decimal('fat_pct', { precision: 4, scale: 2 }),
  snfPct: decimal('snf_pct', { precision: 4, scale: 2 }),
  recordedBy: uuid('recorded_by'),
});

export const healthEvents = zameen.table('health_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  animalId: uuid('animal_id').notNull().references(() => animals.id, { onDelete: 'cascade' }),
  eventType: varchar('event_type', { length: 24 }).notNull(),
  eventDate: date('event_date').notNull(),
  diagnosis: text('diagnosis'),
  treatment: text('treatment'),
  medicineCostPkr: decimal('medicine_cost_pkr', { precision: 14, scale: 2 }),
  vetCostPkr: decimal('vet_cost_pkr', { precision: 14, scale: 2 }),
  withdrawalUntil: date('withdrawal_until'),
  notes: text('notes'),
});

export const feedRecords = zameen.table('feed_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  animalId: uuid('animal_id').references(() => animals.id),
  groupKey: varchar('group_key', { length: 32 }),
  recordedOn: date('recorded_on').notNull(),
  feedMix: jsonb('feed_mix').$type<Array<{ feedName: string; kg: number; costPkr: number }>>().notNull().default([]),
  totalCostPkr: decimal('total_cost_pkr', { precision: 14, scale: 2 }).notNull(),
  recordedBy: uuid('recorded_by'),
});
