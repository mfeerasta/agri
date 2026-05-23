import { boolean, decimal, integer, jsonb, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { zameen } from './_schema.js';
import { entities } from './core.js';
import { assets } from './assets.js';
import { workers } from './labor.js';
import { produceLots } from './inventory.js';

export const vehicles = zameen.table('vehicles', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id').notNull().references(() => entities.id, { onDelete: 'cascade' }),
  registrationNumber: text('registration_number').notNull(),
  make: text('make'),
  model: text('model'),
  vehicleType: text('vehicle_type').notNull(),
  payloadCapacityKg: decimal('payload_capacity_kg', { precision: 10, scale: 2 }),
  fuelType: text('fuel_type').notNull().default('diesel'),
  fuelEconomyKmPerLiter: decimal('fuel_economy_km_per_liter', { precision: 6, scale: 3 }),
  currentOdometerKm: decimal('current_odometer_km', { precision: 12, scale: 2 }),
  assetId: uuid('asset_id').references(() => assets.id),
  driverId: uuid('driver_id').references(() => workers.id),
  isOwned: boolean('is_owned').notNull().default(true),
  hireRatePerKmPkr: decimal('hire_rate_per_km_pkr', { precision: 10, scale: 2 }),
  status: text('status').notNull().default('available'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const dispatchRoutes = zameen.table('dispatch_routes', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id').notNull().references(() => entities.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  originLat: decimal('origin_lat', { precision: 9, scale: 6 }).notNull(),
  originLng: decimal('origin_lng', { precision: 9, scale: 6 }).notNull(),
  destinations: jsonb('destinations').notNull(),
  estimatedDistanceKm: decimal('estimated_distance_km', { precision: 8, scale: 2 }),
  estimatedDurationMinutes: integer('estimated_duration_minutes'),
  tollCostPkr: decimal('toll_cost_pkr', { precision: 10, scale: 2 }),
  savedRoutePolyline: text('saved_route_polyline'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const trips = zameen.table('trips', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id').notNull().references(() => entities.id, { onDelete: 'cascade' }),
  tripNumber: text('trip_number').notNull(),
  vehicleId: uuid('vehicle_id').references(() => vehicles.id),
  driverId: uuid('driver_id').references(() => workers.id),
  routeId: uuid('route_id').references(() => dispatchRoutes.id),
  tripPurpose: text('trip_purpose').notNull(),
  relatedDispatchId: uuid('related_dispatch_id'),
  relatedPurchaseId: uuid('related_purchase_id'),
  departedAt: timestamp('departed_at', { withTimezone: true }),
  arrivedAt: timestamp('arrived_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  startOdometerKm: decimal('start_odometer_km', { precision: 12, scale: 2 }),
  endOdometerKm: decimal('end_odometer_km', { precision: 12, scale: 2 }),
  distanceKm: decimal('distance_km', { precision: 8, scale: 2 }),
  dieselUsedLiters: decimal('diesel_used_liters', { precision: 8, scale: 2 }),
  dieselCostPkr: decimal('diesel_cost_pkr', { precision: 12, scale: 2 }),
  tollCostPkr: decimal('toll_cost_pkr', { precision: 10, scale: 2 }),
  parkingCostPkr: decimal('parking_cost_pkr', { precision: 8, scale: 2 }),
  driverAllowancePkr: decimal('driver_allowance_pkr', { precision: 10, scale: 2 }),
  totalTripCostPkr: decimal('total_trip_cost_pkr', { precision: 14, scale: 2 }),
  cargoDescription: text('cargo_description'),
  cargoWeightKg: decimal('cargo_weight_kg', { precision: 12, scale: 2 }),
  cargoPhotoUrls: jsonb('cargo_photo_urls').$type<string[]>().notNull().default([]),
  proofOfDeliveryUrls: jsonb('proof_of_delivery_urls').$type<string[]>().notNull().default([]),
  gpsTrack: jsonb('gps_track').$type<Array<{ lat: number; lng: number; ts: string }>>(),
  status: text('status').notNull().default('planned'),
  approvalRequestId: uuid('approval_request_id'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const dispatchLoadPlans = zameen.table('dispatch_load_plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  tripId: uuid('trip_id').notNull().references(() => trips.id, { onDelete: 'cascade' }),
  produceLotId: uuid('produce_lot_id').references(() => produceLots.id),
  kgLoaded: decimal('kg_loaded', { precision: 12, scale: 2 }).notNull(),
  loadOrder: integer('load_order').notNull().default(0),
  notes: text('notes'),
});
