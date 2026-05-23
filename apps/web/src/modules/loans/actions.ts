'use server';
import { revalidatePath } from 'next/cache';
import { eq, sum, and } from 'drizzle-orm';
import { db, cropLoans, cropLoanTransactions } from '@zameen/db';
import { submitApproval, buildFullContext } from '@zameen/approvals';
import { postJournal } from '@zameen/finance';
import { getSessionContext } from '@/lib/session';

type Result = { ok: true; id: string } | { ok: false; error: string };

export interface CreateLoanInput {
  entityId: string;
  lenderKind:
    | 'kissan_card'
    | 'agri_bank'
    | 'commercial_bank'
    | 'arhti_advance'
    | 'government_subsidy'
    | 'private_loan';
  lenderName: string;
  loanNumber?: string;
  principalPkr: number;
  interestRatePct?: number;
  disbursementDate: string;
  maturityDate?: string;
  collateralKind?: string;
  collateralDetails?: string;
  purpose?: string;
}

export async function createLoan(input: CreateLoanInput): Promise<Result> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  if (input.principalPkr <= 0) return { ok: false, error: 'Principal must be positive' };
  if (!input.lenderName) return { ok: false, error: 'Lender name required' };

  const [row] = await db
    .insert(cropLoans)
    .values({
      entityId: input.entityId,
      lenderKind: input.lenderKind,
      lenderName: input.lenderName,
      loanNumber: input.loanNumber ?? null,
      principalPkr: input.principalPkr.toFixed(2),
      interestRatePct: input.interestRatePct?.toFixed(3) ?? null,
      disbursementDate: input.disbursementDate,
      maturityDate: input.maturityDate ?? null,
      collateralKind: input.collateralKind ?? null,
      collateralDetails: input.collateralDetails ?? null,
      purpose: input.purpose ?? null,
      status: 'pending',
    })
    .returning();
  if (!row) return { ok: false, error: 'Insert failed' };

  const payload = { loanId: row.id, ...input };
  const contextSnapshot = await buildFullContext({
    entityId: input.entityId,
    approvalType: 'loan',
    payload: payload as Record<string, unknown>,
    requesterUserId: ctx.userId,
    sourceModule: 'loans',
  });
  const req = await submitApproval({
    entityId: input.entityId,
    approvalType: 'loan',
    sourceModule: 'loans',
    sourceRecordId: row.id,
    title: `Crop loan ${input.lenderName} (${input.lenderKind})`,
    amountPkr: input.principalPkr,
    payload,
    contextSnapshot,
    requestedBy: ctx.userId,
    actorRole: ctx.role,
  });
  await db.update(cropLoans).set({ approvalRequestId: req.id }).where(eq(cropLoans.id, row.id));

  if (input.maturityDate) {
    const { generateEmiSchedule } = await import('@/modules/finance/loan-actions');
    await generateEmiSchedule(row.id);
  }

  revalidatePath('/finance/loans');
  return { ok: true, id: row.id };
}

async function principalOutstanding(loanId: string): Promise<number> {
  const [loan] = await db.select().from(cropLoans).where(eq(cropLoans.id, loanId)).limit(1);
  if (!loan) return 0;
  const [{ disbursed }] = await db
    .select({ disbursed: sum(cropLoanTransactions.amountPkr).as('disbursed') })
    .from(cropLoanTransactions)
    .where(and(eq(cropLoanTransactions.loanId, loanId), eq(cropLoanTransactions.kind, 'disbursement')));
  const [{ repaid }] = await db
    .select({ repaid: sum(cropLoanTransactions.amountPkr).as('repaid') })
    .from(cropLoanTransactions)
    .where(and(eq(cropLoanTransactions.loanId, loanId), eq(cropLoanTransactions.kind, 'principal_repayment')));
  return Number(disbursed ?? 0) - Number(repaid ?? 0);
}

export async function recordLoanDisbursement(loanId: string, amountPkr: number, occurredOn: string, notes?: string): Promise<Result> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  if (amountPkr <= 0) return { ok: false, error: 'Amount must be positive' };
  const [loan] = await db.select().from(cropLoans).where(eq(cropLoans.id, loanId)).limit(1);
  if (!loan) return { ok: false, error: 'Loan not found' };

  const journalId = await postJournal({
    entityId: loan.entityId,
    journalNumber: `LOAN-DSB-${loanId.slice(0, 8).toUpperCase()}-${Date.now().toString(36)}`,
    postedOn: occurredOn,
    narration: `Loan disbursement: ${loan.lenderName}`,
    sourceModule: 'loans',
    sourceRecordId: loanId,
    postedBy: ctx.userId,
    lines: [
      { accountCode: '1000', debitPkr: amountPkr, narration: 'Cash received' },
      { accountCode: '2100', creditPkr: amountPkr, narration: 'Loans payable' },
    ],
  });

  const [txn] = await db
    .insert(cropLoanTransactions)
    .values({
      loanId,
      kind: 'disbursement',
      amountPkr: amountPkr.toFixed(2),
      occurredOn,
      journalEntryId: journalId,
      notes: notes ?? null,
    })
    .returning();

  await db.update(cropLoans).set({ status: 'disbursed' }).where(eq(cropLoans.id, loanId));
  revalidatePath('/finance/loans');
  revalidatePath(`/finance/loans/${loanId}`);
  return { ok: true, id: txn!.id };
}

export async function recordLoanRepayment(
  loanId: string,
  kind: 'principal_repayment' | 'interest_payment' | 'fee',
  amountPkr: number,
  occurredOn: string,
  notes?: string,
): Promise<Result> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  if (amountPkr <= 0) return { ok: false, error: 'Amount must be positive' };
  const [loan] = await db.select().from(cropLoans).where(eq(cropLoans.id, loanId)).limit(1);
  if (!loan) return { ok: false, error: 'Loan not found' };

  const lines =
    kind === 'principal_repayment'
      ? [
          { accountCode: '2100', debitPkr: amountPkr, narration: 'Loan principal repaid' },
          { accountCode: '1000', creditPkr: amountPkr, narration: 'Cash paid to lender' },
        ]
      : kind === 'interest_payment'
        ? [
            { accountCode: '5600', debitPkr: amountPkr, narration: 'Interest expense' },
            { accountCode: '1000', creditPkr: amountPkr, narration: 'Cash paid' },
          ]
        : [
            { accountCode: '5600', debitPkr: amountPkr, narration: 'Loan fee' },
            { accountCode: '1000', creditPkr: amountPkr, narration: 'Cash paid' },
          ];

  const journalId = await postJournal({
    entityId: loan.entityId,
    journalNumber: `LOAN-${kind.slice(0, 3).toUpperCase()}-${loanId.slice(0, 8).toUpperCase()}-${Date.now().toString(36)}`,
    postedOn: occurredOn,
    narration: `Loan ${kind}: ${loan.lenderName}`,
    sourceModule: 'loans',
    sourceRecordId: loanId,
    postedBy: ctx.userId,
    lines,
  });

  const [txn] = await db
    .insert(cropLoanTransactions)
    .values({
      loanId,
      kind,
      amountPkr: amountPkr.toFixed(2),
      occurredOn,
      journalEntryId: journalId,
      notes: notes ?? null,
    })
    .returning();

  if (kind === 'principal_repayment') {
    const remaining = await principalOutstanding(loanId);
    const newStatus = remaining <= 0.5 ? 'fully_repaid' : 'partially_repaid';
    await db.update(cropLoans).set({ status: newStatus }).where(eq(cropLoans.id, loanId));
  }

  revalidatePath('/finance/loans');
  revalidatePath(`/finance/loans/${loanId}`);
  return { ok: true, id: txn!.id };
}
