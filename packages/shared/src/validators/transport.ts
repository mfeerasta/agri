import { z } from 'zod';
import { photoUrlsSchema, pkrAmountSchema, uuidSchema } from './common.js';

export const vehicleTypeSchema = z.enum([
  'truck_small',
  'truck_medium',
  'truck_large',
  'tractor_trolley',
  'pickup',
  'suzuki',
  'rickshaw_loader',
  'rented',
  'contractor',
]);
export type VehicleType = z.infer<typeof vehicleTypeSchema>;

export const vehicleStatusSchema = z.enum(['available', 'dispatched', 'maintenance', 'retired']);
export type VehicleStatus = z.infer<typeof vehicleStatusSchema>;

export const vehicleSchema = z.object({
  registrationNumber: z.string().min(1).max(32),
  make: z.string().max(64).optional(),
  model: z.string().max(64).optional(),
  vehicleType: vehicleTypeSchema,
  payloadCapacityKg: z.coerce.number().positive().optional(),
  fuelType: z.string().default('diesel'),
  fuelEconomyKmPerLiter: z.coerce.number().positive().optional(),
  currentOdometerKm: z.coerce.number().nonnegative().optional(),
  assetId: uuidSchema.optional(),
  driverId: uuidSchema.optional(),
  isOwned: z.boolean().default(true),
  hireRatePerKmPkr: pkrAmountSchema.optional(),
  notes: z.string().max(2048).optional(),
});
export type VehicleInput = z.infer<typeof vehicleSchema>;

export const tripPurposeSchema = z.enum([
  'mandi_delivery',
  'input_procurement',
  'inter_farm',
  'emergency',
  'passenger',
  'market_research',
  'other',
]);
export type TripPurpose = z.infer<typeof tripPurposeSchema>;

export const tripStatusSchema = z.enum([
  'planned',
  'dispatched',
  'in_transit',
  'delivered',
  'completed',
  'cancelled',
  'failed',
]);
export type TripStatus = z.infer<typeof tripStatusSchema>;

export const loadPlanLineSchema = z.object({
  produceLotId: uuidSchema,
  kgLoaded: z.coerce.number().positive(),
  loadOrder: z.coerce.number().int().nonnegative().default(0),
  notes: z.string().max(512).optional(),
});

export const dispatchRouteSchema = z.object({
  name: z.string().min(1).max(128),
  originLat: z.coerce.number().min(-90).max(90),
  originLng: z.coerce.number().min(-180).max(180),
  destinations: z
    .array(
      z.object({
        name: z.string().min(1).max(128),
        lat: z.coerce.number().min(-90).max(90),
        lng: z.coerce.number().min(-180).max(180),
        mandi: z.boolean().optional(),
      }),
    )
    .min(1),
  estimatedDistanceKm: z.coerce.number().positive().optional(),
  estimatedDurationMinutes: z.coerce.number().int().positive().optional(),
  tollCostPkr: pkrAmountSchema.optional(),
  savedRoutePolyline: z.string().optional(),
});
export type DispatchRouteInput = z.infer<typeof dispatchRouteSchema>;

export const tripCreateSchema = z.object({
  vehicleId: uuidSchema.optional(),
  driverId: uuidSchema.optional(),
  routeId: uuidSchema.optional(),
  tripPurpose: tripPurposeSchema,
  relatedDispatchId: uuidSchema.optional(),
  relatedPurchaseId: uuidSchema.optional(),
  cargoDescription: z.string().max(512).optional(),
  cargoWeightKg: z.coerce.number().nonnegative().optional(),
  startOdometerKm: z.coerce.number().nonnegative().optional(),
  loadPlan: z.array(loadPlanLineSchema).default([]),
  expectedDieselLiters: z.coerce.number().nonnegative().optional(),
  expectedDieselCostPkr: pkrAmountSchema.optional(),
  expectedTollPkr: pkrAmountSchema.optional(),
  expectedAllowancePkr: pkrAmountSchema.optional(),
  notes: z.string().max(2048).optional(),
});
export type TripCreateInput = z.infer<typeof tripCreateSchema>;

export const tripCompleteSchema = z.object({
  endOdometerKm: z.coerce.number().nonnegative(),
  distanceKm: z.coerce.number().nonnegative().optional(),
  dieselUsedLiters: z.coerce.number().nonnegative(),
  dieselCostPkr: pkrAmountSchema,
  tollCostPkr: pkrAmountSchema.optional(),
  parkingCostPkr: pkrAmountSchema.optional(),
  driverAllowancePkr: pkrAmountSchema.optional(),
  proofOfDeliveryUrls: photoUrlsSchema.min(1, 'Proof of delivery photo required'),
  notes: z.string().max(2048).optional(),
});
export type TripCompleteInput = z.infer<typeof tripCompleteSchema>;

export const tripGpsPointSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  ts: z.string().datetime(),
});
export type TripGpsPoint = z.infer<typeof tripGpsPointSchema>;
