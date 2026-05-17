import { boolean, decimal, jsonb, text, timestamp, uuid, varchar, date } from 'drizzle-orm/pg-core';
import { zameen } from './_schema.js';
import { entities, users } from './core.js';
import { fields } from './land.js';
import { attendanceStatusEnum, workerTypeEnum } from './enums.js';

export const workers = zameen.table('workers', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id').notNull().references(() => entities.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').references(() => users.id),
  haazriWorkerId: uuid('haazri_worker_id'),
  code: varchar('code', { length: 24 }).notNull(),
  fullName: text('full_name').notNull(),
  fullNameUr: text('full_name_ur'),
  phone: varchar('phone', { length: 24 }),
  cnicLast4: varchar('cnic_last4', { length: 4 }),
  workerType: workerTypeEnum('worker_type').notNull().default('daily_wage'),
  monthlySalaryPkr: decimal('monthly_salary_pkr', { precision: 14, scale: 2 }),
  dailyWagePkr: decimal('daily_wage_pkr', { precision: 12, scale: 2 }),
  hireDate: date('hire_date'),
  exitDate: date('exit_date'),
  isActive: boolean('is_active').notNull().default(true),
  notes: text('notes'),
});

export const workerDocuments = zameen.table('worker_documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  workerId: uuid('worker_id').notNull().references(() => workers.id, { onDelete: 'cascade' }),
  documentKind: varchar('document_kind', { length: 32 }).notNull(),
  fileUrl: text('file_url').notNull(),
  uploadedAt: timestamp('uploaded_at', { withTimezone: true }).notNull().defaultNow(),
});

export const attendanceRecords = zameen.table('attendance_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  workerId: uuid('worker_id').notNull().references(() => workers.id, { onDelete: 'cascade' }),
  entityId: uuid('entity_id').notNull().references(() => entities.id),
  workDate: date('work_date').notNull(),
  status: attendanceStatusEnum('status').notNull().default('present'),
  checkInAt: timestamp('check_in_at', { withTimezone: true }),
  checkOutAt: timestamp('check_out_at', { withTimezone: true }),
  checkInGps: jsonb('check_in_gps'),
  checkOutGps: jsonb('check_out_gps'),
  withinGeofence: boolean('within_geofence'),
  notes: text('notes'),
  source: varchar('source', { length: 16 }).notNull().default('pwa'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const tasks = zameen.table('tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id').notNull().references(() => entities.id, { onDelete: 'cascade' }),
  fieldId: uuid('field_id').references(() => fields.id),
  cropPlanId: uuid('crop_plan_id'),
  title: text('title').notNull(),
  titleUr: text('title_ur'),
  description: text('description'),
  taskKind: varchar('task_kind', { length: 32 }).notNull(),
  scheduledFor: date('scheduled_for'),
  estimatedHours: decimal('estimated_hours', { precision: 6, scale: 2 }),
  status: varchar('status', { length: 16 }).notNull().default('open'),
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const taskAssignments = zameen.table('task_assignments', {
  id: uuid('id').primaryKey().defaultRandom(),
  taskId: uuid('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  workerId: uuid('worker_id').notNull().references(() => workers.id, { onDelete: 'cascade' }),
  assignedAt: timestamp('assigned_at', { withTimezone: true }).notNull().defaultNow(),
});

export const taskCompletions = zameen.table('task_completions', {
  id: uuid('id').primaryKey().defaultRandom(),
  taskId: uuid('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  workerId: uuid('worker_id').notNull().references(() => workers.id),
  completedAt: timestamp('completed_at', { withTimezone: true }).notNull().defaultNow(),
  hoursWorked: decimal('hours_worked', { precision: 6, scale: 2 }),
  notes: text('notes'),
  proofPhotoUrls: jsonb('proof_photo_urls').$type<string[]>().notNull().default([]),
});

export const pieceRateLogs = zameen.table('piece_rate_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  workerId: uuid('worker_id').notNull().references(() => workers.id, { onDelete: 'cascade' }),
  taskId: uuid('task_id').references(() => tasks.id),
  workDate: date('work_date').notNull(),
  workKind: varchar('work_kind', { length: 32 }).notNull(),
  unit: varchar('unit', { length: 16 }).notNull(),
  quantity: decimal('quantity', { precision: 12, scale: 4 }).notNull(),
  ratePerUnitPkr: decimal('rate_per_unit_pkr', { precision: 12, scale: 2 }).notNull(),
  totalPkr: decimal('total_pkr', { precision: 14, scale: 2 }).notNull(),
  fieldId: uuid('field_id').references(() => fields.id),
  recordedBy: uuid('recorded_by'),
});

export const payrollRuns = zameen.table('payroll_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id').notNull().references(() => entities.id, { onDelete: 'cascade' }),
  periodStart: date('period_start').notNull(),
  periodEnd: date('period_end').notNull(),
  status: varchar('status', { length: 16 }).notNull().default('draft'),
  totalPkr: decimal('total_pkr', { precision: 16, scale: 2 }).notNull().default('0'),
  approvalRequestId: uuid('approval_request_id'),
  runBy: uuid('run_by'),
  runAt: timestamp('run_at', { withTimezone: true }).notNull().defaultNow(),
});

export const payslips = zameen.table('payslips', {
  id: uuid('id').primaryKey().defaultRandom(),
  payrollRunId: uuid('payroll_run_id').notNull().references(() => payrollRuns.id, { onDelete: 'cascade' }),
  workerId: uuid('worker_id').notNull().references(() => workers.id),
  daysWorked: decimal('days_worked', { precision: 6, scale: 2 }).notNull().default('0'),
  baseSalaryPkr: decimal('base_salary_pkr', { precision: 14, scale: 2 }).notNull().default('0'),
  pieceRateEarningsPkr: decimal('piece_rate_earnings_pkr', { precision: 14, scale: 2 }).notNull().default('0'),
  deductionsPkr: decimal('deductions_pkr', { precision: 14, scale: 2 }).notNull().default('0'),
  advancesPkr: decimal('advances_pkr', { precision: 14, scale: 2 }).notNull().default('0'),
  netPkr: decimal('net_pkr', { precision: 14, scale: 2 }).notNull(),
  breakdown: jsonb('breakdown'),
});
