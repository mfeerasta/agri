import { zameen } from './_schema.js';

export const userRoleEnum = zameen.enum('user_role', [
  'super_admin',
  'director',
  'farm_manager',
  'supervisor',
  'accountant',
  'worker',
  'viewer',
  'auditor',
]);

export const entityKindEnum = zameen.enum('entity_kind', ['proprietorship', 'partnership', 'company', 'aop']);

export const landTenureEnum = zameen.enum('land_tenure', ['owned', 'leased_in', 'leased_out', 'sharecropped']);

export const cropSeasonEnum = zameen.enum('crop_season', ['rabi', 'kharif', 'zaid', 'perennial']);

export const cropStageEnum = zameen.enum('crop_stage', [
  'planned',
  'land_prep',
  'sowing',
  'germination',
  'vegetative',
  'flowering',
  'fruiting',
  'maturity',
  'harvest',
  'post_harvest',
]);

export const inputTypeEnum = zameen.enum('input_type', [
  'seed',
  'fertilizer',
  'pesticide',
  'herbicide',
  'fungicide',
  'fuel',
  'packaging',
  'other',
]);

export const assetCategoryEnum = zameen.enum('asset_category', [
  'tractor',
  'harvester',
  'thresher',
  'sprayer',
  'tubewell',
  'generator',
  'implement',
  'vehicle',
  'building',
  'other',
]);

export const repairSeverityEnum = zameen.enum('repair_severity', [
  'operational',
  'minor',
  'major',
  'breakdown',
]);

export const repairStatusEnum = zameen.enum('repair_status', [
  'reported',
  'quotes_pending',
  'approval_pending',
  'approved',
  'in_progress',
  'completed',
  'cancelled',
]);

export const approvalStateEnum = zameen.enum('approval_state', [
  'draft',
  'submitted',
  'in_review',
  'approved',
  'rejected',
  'sent_back',
  'executed',
  'closed',
  'emergency_executed',
]);

export const approvalActionEnum = zameen.enum('approval_action', [
  'submit',
  'approve',
  'reject',
  'send_back',
  'escalate',
  'delegate',
  'execute',
  'reverse',
  'emergency_override',
  'comment',
]);

export const approvalTypeEnum = zameen.enum('approval_type', [
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
]);

export const animalSpeciesEnum = zameen.enum('animal_species', ['cattle', 'buffalo', 'goat', 'sheep', 'other']);

export const animalSexEnum = zameen.enum('animal_sex', ['male', 'female']);

export const workerTypeEnum = zameen.enum('worker_type', [
  'permanent',
  'seasonal',
  'daily_wage',
  'contract',
  'piece_rate',
]);

export const attendanceStatusEnum = zameen.enum('attendance_status', [
  'present',
  'absent',
  'half_day',
  'leave',
  'sick',
]);

export const paymentMethodEnum = zameen.enum('payment_method', [
  'cash',
  'credit',
  'bank_transfer',
  'card',
  'fuel_card',
  'cheque',
]);

export const produceGradeEnum = zameen.enum('produce_grade', ['a', 'b', 'c', 'reject']);

export const documentTypeEnum = zameen.enum('document_type', [
  'fard',
  'mutation',
  'lease_deed',
  'tubewell_license',
  'warabandi_schedule',
  'tax_filing',
  'subsidy',
  'invoice',
  'receipt',
  'photo',
  'other',
]);
