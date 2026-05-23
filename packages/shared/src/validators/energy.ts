import { z } from 'zod';

export const meterKindEnum = z.enum([
  'grid_electricity',
  'solar_inverter',
  'generator',
  'tubewell_pump',
  'cold_storage',
  'farm_kitchen',
  'farmhouse',
  'other',
]);

export const connectionKindEnum = z.enum([
  'agri',
  'commercial',
  'domestic',
  'industrial',
  'solar_net_metering',
]);

export const readingTimeEnum = z.enum(['on_peak', 'off_peak', 'total']);

export const generatorRunReasonEnum = z.enum([
  'grid_outage',
  'peak_shaving',
  'testing',
  'planned_maintenance',
  'event',
  'other',
]);

export const energyMeterSchema = z.object({
  entityId: z.string().uuid(),
  meterNumber: z.string().min(1),
  meterKind: meterKindEnum,
  assetId: z.string().uuid().optional(),
  fieldId: z.string().uuid().optional(),
  capacityKw: z.number().positive().optional(),
  tariffPkrPerKwh: z.number().nonnegative().optional(),
  connectionKind: connectionKindEnum.optional(),
  referenceNumber: z.string().optional(),
  installedOn: z.string().optional(),
});

export const energyReadingSchema = z.object({
  meterId: z.string().uuid(),
  readingDate: z.string(),
  readingTime: readingTimeEnum.default('total'),
  readingValue: z.number().nonnegative(),
  consumptionKwh: z.number().nonnegative().optional(),
  generationKwh: z.number().nonnegative().optional(),
  exportKwh: z.number().nonnegative().optional(),
  costPkr: z.number().nonnegative().optional(),
  billUrl: z.string().url().optional(),
  notes: z.string().optional(),
});

export const solarSystemSchema = z.object({
  entityId: z.string().uuid(),
  installationName: z.string().min(1),
  panelsCount: z.number().int().positive(),
  totalCapacityKw: z.number().positive(),
  panelModel: z.string().optional(),
  inverterModel: z.string().optional(),
  batteryCapacityKwh: z.number().nonnegative().optional(),
  installer: z.string().optional(),
  commissionedOn: z.string(),
  warrantyUntil: z.string().optional(),
  costPkr: z.number().nonnegative().optional(),
  estimatedAnnualGenerationKwh: z.number().nonnegative().optional(),
  netMeteringApproved: z.boolean().default(false),
  notes: z.string().optional(),
});

export const generatorRunSchema = z.object({
  assetId: z.string().uuid(),
  startedAt: z.string(),
  endedAt: z.string().optional(),
  hoursRun: z.number().nonnegative().optional(),
  dieselConsumedLiters: z.number().nonnegative().optional(),
  outputKwhEstimated: z.number().nonnegative().optional(),
  reason: generatorRunReasonEnum.optional(),
  fuelCostPkr: z.number().nonnegative().optional(),
  notes: z.string().optional(),
});
