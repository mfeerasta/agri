import { date, decimal, integer, text, uuid } from 'drizzle-orm/pg-core';
import { zameen } from './_schema.js';
import { cropLoans } from './crop-loans.js';

export const loanEmiSchedules = zameen.table('loan_emi_schedules', {
  id: uuid('id').primaryKey().defaultRandom(),
  loanId: uuid('loan_id').notNull().references(() => cropLoans.id, { onDelete: 'cascade' }),
  installmentNumber: integer('installment_number').notNull(),
  dueOn: date('due_on').notNull(),
  principalPkr: decimal('principal_pkr', { precision: 14, scale: 2 }).notNull(),
  interestPkr: decimal('interest_pkr', { precision: 14, scale: 2 }).notNull(),
  totalPkr: decimal('total_pkr', { precision: 14, scale: 2 }).notNull(),
  paidOn: date('paid_on'),
  paidPkr: decimal('paid_pkr', { precision: 14, scale: 2 }),
  status: text('status').notNull().default('scheduled'),
  paymentRecordId: uuid('payment_record_id'),
});

export type LoanEmiStatus = 'scheduled' | 'paid' | 'partial' | 'overdue' | 'waived';
