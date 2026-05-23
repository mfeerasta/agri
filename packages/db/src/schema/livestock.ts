import { decimal, integer, jsonb, text, timestamp, uuid, varchar, date } from 'drizzle-orm/pg-core';
import { zameen } from './_schema.js';
import { entities } from './core.js';
import { inputs } from './inventory.js';
import { animalSexEnum, animalSpeciesEnum } from './enums.js';

export const livestockHerds = zameen.table('livestock_herds', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id').notNull().references(() => entities.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  nameUr: text('name_ur'),
  species: varchar('species', { length: 16 }).notNull(),
  purpose: varchar('purpose', { length: 16 }),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const animals = zameen.table('animals', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id').notNull().references(() => entities.id, { onDelete: 'cascade' }),
  herdId: uuid('herd_id').references(() => livestockHerds.id, { onDelete: 'set null' }),
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

export const livestockBreedingCycles = zameen.table('livestock_breeding_cycles', {
  id: uuid('id').primaryKey().defaultRandom(),
  femaleAnimalId: uuid('female_animal_id').notNull().references(() => animals.id, { onDelete: 'cascade' }),
  maleAnimalId: uuid('male_animal_id').references(() => animals.id),
  semenSource: text('semen_source'),
  bredOn: date('bred_on').notNull(),
  confirmedPregnantOn: date('confirmed_pregnant_on'),
  expectedCalvingDate: date('expected_calving_date'),
  actualCalvingDate: date('actual_calving_date'),
  offspringCount: integer('offspring_count'),
  outcome: varchar('outcome', { length: 16 }),
  vetName: text('vet_name'),
  costPkr: decimal('cost_pkr', { precision: 12, scale: 2 }),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// Legacy lightweight breeding events table (kept for compatibility with existing UI)
export const breedingEvents = zameen.table('breeding_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  animalId: uuid('animal_id').notNull().references(() => animals.id, { onDelete: 'cascade' }),
  eventType: varchar('event_type', { length: 24 }).notNull(),
  eventDate: date('event_date').notNull(),
  details: jsonb('details'),
  recordedBy: uuid('recorded_by'),
});

export const milkProductionLogs = zameen.table('milk_production_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  animalId: uuid('animal_id').references(() => animals.id, { onDelete: 'cascade' }),
  herdId: uuid('herd_id').references(() => livestockHerds.id, { onDelete: 'cascade' }),
  logDate: date('log_date').notNull(),
  shift: varchar('shift', { length: 16 }).notNull(),
  liters: decimal('liters', { precision: 8, scale: 2 }).notNull(),
  fatPct: decimal('fat_pct', { precision: 5, scale: 2 }),
  snfPct: decimal('snf_pct', { precision: 5, scale: 2 }),
  notes: text('notes'),
  recordedBy: uuid('recorded_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const feedIssuances = zameen.table('feed_issuances', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id').notNull().references(() => entities.id),
  inputId: uuid('input_id').notNull().references(() => inputs.id),
  herdId: uuid('herd_id').references(() => livestockHerds.id),
  animalId: uuid('animal_id').references(() => animals.id),
  issuedOn: timestamp('issued_on', { withTimezone: true }).notNull(),
  quantity: decimal('quantity', { precision: 14, scale: 4 }).notNull(),
  unitCostPkr: decimal('unit_cost_pkr', { precision: 14, scale: 2 }).notNull(),
  totalCostPkr: decimal('total_cost_pkr', { precision: 14, scale: 2 }).notNull(),
  notes: text('notes'),
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const livestockHealthEvents = zameen.table('livestock_health_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  animalId: uuid('animal_id').notNull().references(() => animals.id, { onDelete: 'cascade' }),
  eventKind: varchar('event_kind', { length: 24 }).notNull(),
  occurredOn: date('occurred_on').notNull(),
  diagnosis: text('diagnosis'),
  medication: text('medication'),
  dosage: text('dosage'),
  vetName: text('vet_name'),
  costPkr: decimal('cost_pkr', { precision: 12, scale: 2 }),
  withdrawalPeriodDays: integer('withdrawal_period_days'),
  nextDueOn: date('next_due_on'),
  notes: text('notes'),
  photoUrls: jsonb('photo_urls').$type<string[]>().notNull().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
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
