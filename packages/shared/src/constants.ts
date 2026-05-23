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
};

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
] as const;
export type CostPool = (typeof COST_POOLS)[number];
