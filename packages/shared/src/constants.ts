export const APPROVAL_TYPES = [
  'feasibility_study',
  'input_purchase',
  'diesel_purchase',
  'repair',
  'asset_purchase',
  'livestock_purchase',
  'livestock_sale',
  'crop_sale',
  'labor_hire',
  'lease',
  'capex',
  'land_transaction',
  'tax_payment',
  'loan',
  'insurance',
  'bonus_award',
  'lease_payment',
  'forward_contract',
  'preventive_maintenance',
  'vendor_selection',
  'carbon_credit_sale',
] as const;
export type ApprovalType = (typeof APPROVAL_TYPES)[number];

export const DEFAULT_APPROVAL_THRESHOLDS_PKR: Record<
  ApprovalType,
  { supervisor: number | null; farm_manager: number | null; director: number | null }
> = {
  feasibility_study: { supervisor: 0, farm_manager: 0, director: 0 },
  input_purchase: { supervisor: 25_000, farm_manager: 100_000, director: null },
  diesel_purchase: { supervisor: 25_000, farm_manager: 50_000, director: null },
  repair: { supervisor: 10_000, farm_manager: 50_000, director: null },
  asset_purchase: { supervisor: 0, farm_manager: 0, director: null },
  livestock_purchase: { supervisor: 0, farm_manager: 0, director: null },
  livestock_sale: { supervisor: 0, farm_manager: 0, director: null },
  crop_sale: { supervisor: 0, farm_manager: 500_000, director: null },
  labor_hire: { supervisor: 0, farm_manager: 0, director: null },
  lease: { supervisor: 0, farm_manager: 0, director: 0 },
  capex: { supervisor: 0, farm_manager: 0, director: null },
  land_transaction: { supervisor: 0, farm_manager: 0, director: 0 },
  tax_payment: { supervisor: 0, farm_manager: 0, director: null },
  loan: { supervisor: 0, farm_manager: 0, director: 0 },
  insurance: { supervisor: 0, farm_manager: 50_000, director: 250_000 },
  bonus_award: { supervisor: 0, farm_manager: 25_000, director: 100_000 },
  lease_payment: { supervisor: 0, farm_manager: 50_000, director: 250_000 },
  forward_contract: { supervisor: 0, farm_manager: 0, director: 0 },
  preventive_maintenance: { supervisor: 5_000, farm_manager: 25_000, director: 100_000 },
  vendor_selection: { supervisor: 0, farm_manager: 100_000, director: 500_000 },
  carbon_credit_sale: { supervisor: 0, farm_manager: 0, director: 0 },
};

// Carbon emission factors (kg CO2e per unit).
export const CARBON_FACTORS = {
  dieselCombustionKgPerLiter: 2.68,
  gridElectricityKgPerKwh: 0.45, // Pakistan grid average
  entericCh4KgPerCattleYear: 89, // Sahiwal cow estimate
  entericCh4KgPerBuffaloYear: 110,
  entericCh4KgPerGoatYear: 9,
  entericCh4KgPerSheepYear: 8,
  gwpCh4: 25,
  gwpN2o: 298,
  riceFloodedCh4KgPerAcreSeason: 540, // continuous flooding baseline
  riceAwdReductionFactor: 0.48, // AWD cuts ~48%
  syntheticNFertilizerN2oFractionKgPerKgN: 0.01, // IPCC tier-1
  fertilizerKgNPerKgUrea: 0.46,
  transportKgCo2ePerTonKm: 0.062, // road freight
  soilCarbonTcPerAcreYearNoTill: 0.18,
  soilCarbonTcPerAcreYearCoverCrop: 0.14,
  soilCarbonTcPerAcreYearBiochar: 0.95,
  agroforestryTco2ePerTreeYear: 0.022,
  cToCo2eFactor: 3.667,
} as const;

export const CARBON_CREDIT_STANDARDS = [
  'verra_vcs',
  'gold_standard',
  'climate_action_reserve',
  'plan_vivo',
  'clean_development_mechanism',
  'custom_voluntary',
] as const;
export type CarbonCreditStandard = (typeof CARBON_CREDIT_STANDARDS)[number];

export const SUSTAINABILITY_PRACTICE_KINDS = [
  'no_till',
  'reduced_till',
  'cover_cropping',
  'crop_rotation',
  'organic_amendments',
  'biochar_application',
  'agroforestry',
  'contour_farming',
  'drip_irrigation',
  'mulching',
  'integrated_pest_management',
  'reduced_synthetic_fertilizer',
  'manure_management',
  'rice_alternate_wetting_drying',
  'enteric_methane_reducer',
  'renewable_energy',
  'water_harvesting',
  'windbreak_planting',
  'rotational_grazing',
  'other',
] as const;
export type SustainabilityPracticeKind = (typeof SUSTAINABILITY_PRACTICE_KINDS)[number];

export const USER_ROLES = [
  'super_admin',
  'director',
  'farm_manager',
  'supervisor',
  'accountant',
  'worker',
  'viewer',
  'auditor',
] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const ROLE_RANK: Record<UserRole, number> = {
  super_admin: 100,
  director: 90,
  farm_manager: 70,
  supervisor: 50,
  accountant: 40,
  worker: 20,
  viewer: 10,
  auditor: 15,
};

export const DIESEL_VARIANCE_TOLERANCE_PCT = 1.5; // 1.5% closing variance triggers alert
export const ASSET_FUEL_BURN_ANOMALY_PCT = 15; // 15% above rolling 30d avg triggers anomaly
export const EMERGENCY_APPROVAL_GRACE_HOURS = 48;
export const APPROVAL_REVERSAL_WINDOW_HOURS = 24;

export const PHOTO_MAX_BYTES = 200 * 1024;
export const PHOTO_TARGET_LONG_EDGE_PX = 1600;

export const COST_POOLS = [
  'seed',
  'fertilizer',
  'pesticide',
  'diesel',
  'labor_field',
  'labor_livestock',
  'repairs',
  'irrigation',
  'land_rent',
  'vet',
  'feed',
  'freight',
  'mandi_charges',
  'admin',
  'depreciation',
  'finance_charges',
  'tax',
  'asset_maintenance',
  'transport_fuel',
  'transport_other',
] as const;
export type CostPool = (typeof COST_POOLS)[number];
