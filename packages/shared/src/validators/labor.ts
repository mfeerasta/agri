import { z } from 'zod';
import { dateIsoSchema, phonePkSchema, pkrAmountSchema, uuidSchema } from './common.js';

export const workerCreateSchema = z
  .object({
    entityId: uuidSchema,
    code: z.string().min(1).max(24),
    fullName: z.string().min(1).max(256),
    fullNameUr: z.string().max(256).optional(),
    phone: phonePkSchema.optional(),
    cnicLast4: z.string().regex(/^\d{4}$/).optional(),
    workerType: z.enum(['permanent', 'seasonal', 'daily_wage', 'contract', 'piece_rate']),
    monthlySalaryPkr: pkrAmountSchema.optional(),
    dailyWagePkr: pkrAmountSchema.optional(),
    hireDate: dateIsoSchema,
    notes: z.string().max(2000).optional(),
  })
  .refine(
    (v) => !!v.monthlySalaryPkr || !!v.dailyWagePkr,
    'Provide monthly salary or daily wage',
  );
export type WorkerCreateInput = z.infer<typeof workerCreateSchema>;

export const pieceRateSchema = z.object({
  entityId: uuidSchema,
  workerId: uuidSchema,
  workDate: dateIsoSchema,
  workKind: z.string().min(1).max(32),
  unit: z.enum(['kg', 'mann', 'acre', 'piece', 'hour']),
  quantity: z.coerce.number().positive(),
  ratePerUnitPkr: z.coerce.number().positive(),
  fieldId: uuidSchema,
  taskId: uuidSchema.optional(),
});
export type PieceRateInput = z.infer<typeof pieceRateSchema>;

export const payrollRunSchema = z.object({
  entityId: uuidSchema,
  periodStart: dateIsoSchema,
  periodEnd: dateIsoSchema,
  notes: z.string().max(2000).optional(),
});
export type PayrollRunInput = z.infer<typeof payrollRunSchema>;

export const taskAssignSchema = z.object({
  taskId: uuidSchema,
  workerIds: z.array(uuidSchema).min(1),
});
export type TaskAssignInput = z.infer<typeof taskAssignSchema>;
