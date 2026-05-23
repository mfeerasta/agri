import { boolean, date, decimal, integer, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { zameen } from './_schema.js';
import { entities } from './core.js';
import { assets } from './assets.js';

export const cooperatives = zameen.table('cooperatives', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  nameUr: text('name_ur'),
  registrationNumber: text('registration_number'),
  authority: text('authority'),
  registrationDate: date('registration_date'),
  charterDocUrl: text('charter_doc_url'),
  defaultMeetingDay: text('default_meeting_day'),
  bankAccountNumber: text('bank_account_number'),
  bankName: text('bank_name'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const cooperativeMembers = zameen.table('cooperative_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  cooperativeId: uuid('cooperative_id').notNull().references(() => cooperatives.id, { onDelete: 'cascade' }),
  memberName: text('member_name').notNull(),
  cnic: text('cnic'),
  phone: text('phone'),
  email: text('email'),
  village: text('village'),
  totalAcres: decimal('total_acres', { precision: 10, scale: 3 }),
  cropsGrown: text('crops_grown').array(),
  joinedOn: date('joined_on').notNull(),
  membershipStatus: text('membership_status').notNull().default('active'),
  withdrawalDate: date('withdrawal_date'),
  sharesHeld: integer('shares_held').notNull().default(1),
  contributionPkrToDate: decimal('contribution_pkr_to_date', { precision: 14, scale: 2 }).notNull().default('0'),
  relatedEntityId: uuid('related_entity_id').references(() => entities.id),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const groupBuyingPools = zameen.table('group_buying_pools', {
  id: uuid('id').primaryKey().defaultRandom(),
  cooperativeId: uuid('cooperative_id').notNull().references(() => cooperatives.id, { onDelete: 'cascade' }),
  itemName: text('item_name').notNull(),
  itemKind: text('item_kind').notNull(),
  targetTotalQuantity: decimal('target_total_quantity', { precision: 14, scale: 4 }).notNull(),
  unit: text('unit').notNull(),
  estimatedPerUnitPkr: decimal('estimated_per_unit_pkr', { precision: 12, scale: 2 }),
  estimatedSavingsPct: decimal('estimated_savings_pct', { precision: 5, scale: 2 }),
  status: text('status').notNull().default('open'),
  closesOn: date('closes_on'),
  procuredOn: date('procured_on'),
  actualPerUnitPkr: decimal('actual_per_unit_pkr', { precision: 12, scale: 2 }),
  vendorId: uuid('vendor_id'),
  approvalRequestId: uuid('approval_request_id'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const groupBuyingPledges = zameen.table('group_buying_pledges', {
  id: uuid('id').primaryKey().defaultRandom(),
  poolId: uuid('pool_id').notNull().references(() => groupBuyingPools.id, { onDelete: 'cascade' }),
  memberId: uuid('member_id').notNull().references(() => cooperativeMembers.id, { onDelete: 'cascade' }),
  pledgedQuantity: decimal('pledged_quantity', { precision: 14, scale: 4 }).notNull(),
  deliveredQuantity: decimal('delivered_quantity', { precision: 14, scale: 4 }).notNull().default('0'),
  pledgeAmountPkr: decimal('pledge_amount_pkr', { precision: 14, scale: 2 }),
  paidPkr: decimal('paid_pkr', { precision: 14, scale: 2 }).notNull().default('0'),
  paidOn: date('paid_on'),
  status: text('status').notNull().default('pledged'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const equipmentSharingArrangements = zameen.table('equipment_sharing_arrangements', {
  id: uuid('id').primaryKey().defaultRandom(),
  assetId: uuid('asset_id').notNull().references(() => assets.id, { onDelete: 'cascade' }),
  cooperativeId: uuid('cooperative_id').references(() => cooperatives.id),
  ratePerHourPkr: decimal('rate_per_hour_pkr', { precision: 10, scale: 2 }),
  ratePerAcrePkr: decimal('rate_per_acre_pkr', { precision: 10, scale: 2 }),
  ratePerDayPkr: decimal('rate_per_day_pkr', { precision: 10, scale: 2 }),
  minimumChargePkr: decimal('minimum_charge_pkr', { precision: 10, scale: 2 }),
  fuelArrangement: text('fuel_arrangement'),
  operatorProvided: boolean('operator_provided').notNull().default(false),
  operatorRatePkr: decimal('operator_rate_pkr', { precision: 10, scale: 2 }),
  isActive: boolean('is_active').notNull().default(true),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const equipmentRentals = zameen.table('equipment_rentals', {
  id: uuid('id').primaryKey().defaultRandom(),
  arrangementId: uuid('arrangement_id').notNull().references(() => equipmentSharingArrangements.id, { onDelete: 'cascade' }),
  renterMemberId: uuid('renter_member_id').references(() => cooperativeMembers.id),
  renterName: text('renter_name'),
  renterPhone: text('renter_phone'),
  rentedForFieldId: uuid('rented_for_field_id'),
  startAt: timestamp('start_at', { withTimezone: true }).notNull(),
  endAt: timestamp('end_at', { withTimezone: true }),
  hoursUsed: decimal('hours_used', { precision: 8, scale: 2 }),
  acresWorked: decimal('acres_worked', { precision: 8, scale: 3 }),
  totalChargePkr: decimal('total_charge_pkr', { precision: 12, scale: 2 }),
  fuelChargePkr: decimal('fuel_charge_pkr', { precision: 10, scale: 2 }),
  operatorChargePkr: decimal('operator_charge_pkr', { precision: 10, scale: 2 }),
  paidPkr: decimal('paid_pkr', { precision: 12, scale: 2 }).notNull().default('0'),
  status: text('status').notNull().default('active'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
