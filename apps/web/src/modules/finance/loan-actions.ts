'use server';
import { revalidatePath } from 'next/cache';
import { eq, and, lt, inArray } from 'drizzle-orm';
import { db, cropLoans, loanEmiSchedules, cropLoanTransactions } from '@zameen/db';
import { submitApproval, buildFullContext } from '@zameen/approvals';
import { postJournal } from '@zameen/finance';
import { getSessionContext } from '@/lib/session';

type Result = { ok: true; id: string; count?: number } | { ok: false; error: string };

function addMonths(iso: string, months: number): string {
  const d = new Date(iso);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

function monthsBetween(start: string, end: string): number {
  const s = new Date(start);
  const e = new Date(end);
  return Math.max(1, (e.getUTCFullYear() - s.getUTCFullYear()) * 12 + (e.getUTCMonth() - s.getUTCMonth()));
}

/**
 * Generates an amortization schedule for the loan. Uses reducing-balance EMI
 * for commercial/agri bank loans and flat-rate distribution for kissan_card or
 * arhti_advance where banks quote flat interest.
 */
export async function generateEmiSchedule(loanId: string): Promise<Result> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };

  const [loan] = await db.select().from(cropLoans).where(eq(cropLoans.id, loanId)).limit(1);
  if (!loan) return { ok: false, error: 'Loan not found' };
  if (!loan.maturityDate) return { ok: false, error: 'Maturity date required to schedule EMIs' };

  const existing = await db.select({ id: loanEmiSchedules.id }).from(loanEmiSchedules).where(eq(loanEmiSchedules.loanId, loanId));
  if (existing.length > 0) return { ok: false, error: 'Schedule already generated' };

  const principal = Number(loan.principalPkr);
  const ratePct = Number(loan.interestRatePct ?? 0);
  const months = monthsBetween(loan.disbursementDate, loan.maturityDate);
  const flatLenders = new Set(['kissan_card', 'arhti_advance']);
  const isFlat = flatLenders.has(loan.lenderKind);

  const rows: Array<{
    loanId: string;
    installmentNumber: number;
    dueOn: string;
    principalPkr: string;
    interestPkr: string;
    totalPkr: string;
  }> = [];

  if (isFlat || ratePct === 0) {
    const totalInterest = principal * (ratePct / 100) * (months / 12);
    const flatPrincipal = principal / months;
    const flatInterest = totalInterest / months;
    for (let i = 1; i <= months; i++) {
      rows.push({
        loanId,
        installmentNumber: i,
        dueOn: addMonths(loan.disbursementDate, i),
        principalPkr: flatPrincipal.toFixed(2),
        interestPkr: flatInterest.toFixed(2),
        totalPkr: (flatPrincipal + flatInterest).toFixed(2),
      });
    }
  } else {
    const r = ratePct / 100 / 12;
    const pmt = (principal * r) / (1 - Math.pow(1 + r, -months));
    let balance = principal;
    for (let i = 1; i <= months; i++) {
      const interest = balance * r;
      const principalPortion = pmt - interest;
      balance = Math.max(0, balance - principalPortion);
      rows.push({
        loanId,
        installmentNumber: i,
        dueOn: addMonths(loan.disbursementDate, i),
        principalPkr: principalPortion.toFixed(2),
        interestPkr: interest.toFixed(2),
        totalPkr: pmt.toFixed(2),
      });
    }
  }

  await db.insert(loanEmiSchedules).values(rows);
  revalidatePath(`/finance/loans/${loanId}`);
  return { ok: true, id: loanId, count: rows.length };
}

export interface RecordEmiPaymentInput {
  emiId: string;
  paidPkr: number;
  paidOn: string;
  notes?: string;
}

export async function recordEmiPayment(input: RecordEmiPaymentInput): Promise<Result> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  if (input.paidPkr <= 0) return { ok: false, error: 'Amount must be positive' };

  const [emi] = await db.select().from(loanEmiSchedules).where(eq(loanEmiSchedules.id, input.emiId)).limit(1);
  if (!emi) return { ok: false, error: 'EMI not found' };
  if (emi.status === 'paid' || emi.status === 'waived') return { ok: false, error: 'EMI already settled' };

  const [loan] = await db.select().from(cropLoans).where(eq(cropLoans.id, emi.loanId)).limit(1);
  if (!loan) return { ok: false, error: 'Loan not found' };

  // route through approval engine
  const payload = {
    emiId: emi.id,
    loanId: loan.id,
    installmentNumber: emi.installmentNumber,
    paidPkr: input.paidPkr,
    paidOn: input.paidOn,
    notes: input.notes,
  };
  const contextSnapshot = await buildFullContext({
    entityId: loan.entityId,
    approvalType: 'loan',
    payload: payload as Record<string, unknown>,
    requesterUserId: ctx.userId,
    sourceModule: 'loans',
  });
  await submitApproval({
    entityId: loan.entityId,
    approvalType: 'loan',
    sourceModule: 'loans',
    sourceRecordId: emi.id,
    title: `EMI ${emi.installmentNumber} payment for ${loan.lenderName}`,
    amountPkr: input.paidPkr,
    payload,
    contextSnapshot,
    requestedBy: ctx.userId,
    actorRole: ctx.role,
  });

  // post journal: split into principal + interest by EMI plan ratio
  const totalPlanned = Number(emi.totalPkr);
  const principalPart = totalPlanned > 0 ? (Number(emi.principalPkr) / totalPlanned) * input.paidPkr : input.paidPkr;
  const interestPart = input.paidPkr - principalPart;

  const journalId = await postJournal({
    entityId: loan.entityId,
    journalNumber: `LOAN-EMI-${emi.id.slice(0, 8).toUpperCase()}-${Date.now().toString(36)}`,
    postedOn: input.paidOn,
    narration: `EMI ${emi.installmentNumber} for ${loan.lenderName}`,
    sourceModule: 'loans',
    sourceRecordId: emi.id,
    postedBy: ctx.userId,
    lines: [
      { accountCode: '2100', debitPkr: principalPart, narration: 'Principal repaid' },
      { accountCode: '5600', debitPkr: interestPart, narration: 'Interest expense' },
      { accountCode: '1000', creditPkr: input.paidPkr, narration: 'Cash paid' },
    ],
  });

  const [txn] = await db
    .insert(cropLoanTransactions)
    .values({
      loanId: loan.id,
      kind: 'principal_repayment',
      amountPkr: input.paidPkr.toFixed(2),
      occurredOn: input.paidOn,
      journalEntryId: journalId,
      notes: `EMI ${emi.installmentNumber}${input.notes ? `: ${input.notes}` : ''}`,
    })
    .returning();

  const newStatus = input.paidPkr + 0.5 >= totalPlanned ? 'paid' : 'partial';
  await db
    .update(loanEmiSchedules)
    .set({
      paidOn: input.paidOn,
      paidPkr: input.paidPkr.toFixed(2),
      status: newStatus,
      paymentRecordId: txn!.id,
    })
    .where(eq(loanEmiSchedules.id, emi.id));

  revalidatePath(`/finance/loans/${loan.id}`);
  return { ok: true, id: emi.id };
}

export async function markOverdueEmis(): Promise<{ marked: number }> {
  const today = new Date().toISOString().slice(0, 10);
  const stale = await db
    .select({ id: loanEmiSchedules.id })
    .from(loanEmiSchedules)
    .where(and(eq(loanEmiSchedules.status, 'scheduled'), lt(loanEmiSchedules.dueOn, today)));
  if (stale.length === 0) return { marked: 0 };
  await db
    .update(loanEmiSchedules)
    .set({ status: 'overdue' })
    .where(inArray(loanEmiSchedules.id, stale.map((s) => s.id)));
  return { marked: stale.length };
}
