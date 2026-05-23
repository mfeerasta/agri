'use server';
/**
 * Bank statement import + payment order actions.
 *
 * Parses common Pakistani bank CSV formats (HBL, MCB, UBL, Faysal, Meezan)
 * into bank_transactions rows. PDF imports fall back to Claude vision OCR
 * (placeholder: caller passes pre-parsed rows from the OCR pipeline).
 * Payment orders route through @zameen/approvals; nothing reaches the bank
 * rails until approved.
 */
import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import {
  db,
  bankAccounts,
  bankTransactions,
  bankStatements,
  paymentOrders,
} from '@zameen/db';
import { submitApproval, buildFullContext } from '@zameen/approvals';
import { autoMatch } from '@zameen/finance';
import { getSessionContext } from '@/lib/session';

type Result<T = { id: string }> = ({ ok: true } & T) | { ok: false; error: string };

interface ParsedRow {
  transactionDate: string;
  valueDate?: string;
  amountPkr: number;
  direction: 'debit' | 'credit';
  description: string;
  counterparty?: string;
  referenceNumber?: string;
  bankReference?: string;
}

type BankFormat = 'hbl' | 'mcb' | 'ubl' | 'faysal' | 'meezan' | 'generic';

function detectFormat(headerLine: string): BankFormat {
  const h = headerLine.toLowerCase();
  if (h.includes('trxn date') && h.includes('part trxn type')) return 'hbl';
  if (h.includes('value date') && h.includes('cheque') && h.includes('mcb')) return 'mcb';
  if (h.includes('ubl') || (h.includes('post date') && h.includes('amount'))) return 'ubl';
  if (h.includes('faysal')) return 'faysal';
  if (h.includes('meezan') || h.includes('shariah')) return 'meezan';
  return 'generic';
}

function parseAmount(raw: string | undefined): number {
  if (!raw) return 0;
  const cleaned = raw.replace(/[,\s]/g, '').replace(/[()]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function normalizeIsoDate(raw: string | undefined): string {
  if (!raw) return new Date().toISOString().slice(0, 10);
  const t = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  const dmy = t.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
  if (dmy) {
    const d = dmy[1]!.padStart(2, '0');
    const m = dmy[2]!.padStart(2, '0');
    let y = dmy[3]!;
    if (y.length === 2) y = `20${y}`;
    return `${y}-${m}-${d}`;
  }
  return new Date(t).toISOString().slice(0, 10);
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') q = !q;
    else if (ch === ',' && !q) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function parseCsv(csv: string): { rows: ParsedRow[]; format: BankFormat } {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return { rows: [], format: 'generic' };
  const headerLine = lines[0]!;
  const format = detectFormat(headerLine);
  const header = splitCsvLine(headerLine).map((s) => s.toLowerCase());
  const col = (...names: string[]) => {
    for (const n of names) {
      const idx = header.indexOf(n);
      if (idx >= 0) return idx;
    }
    return -1;
  };

  const dateCol = col('date', 'transaction date', 'trxn date', 'post date', 'posted on');
  const valueDateCol = col('value date', 'value_date');
  const descCol = col('description', 'narration', 'particulars', 'remarks');
  const debitCol = col('debit', 'withdrawal', 'dr', 'debit amount');
  const creditCol = col('credit', 'deposit', 'cr', 'credit amount');
  const amountCol = col('amount');
  const refCol = col('reference', 'ref', 'reference number', 'cheque no', 'trxn ref');
  const partyCol = col('counterparty', 'beneficiary', 'party', 'merchant');

  const out: ParsedRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]!);
    if (cols.length < 2) continue;
    const debit = debitCol >= 0 ? parseAmount(cols[debitCol]) : 0;
    const credit = creditCol >= 0 ? parseAmount(cols[creditCol]) : 0;
    let amount = 0;
    let direction: 'debit' | 'credit' = 'credit';
    if (debit > 0) {
      amount = debit;
      direction = 'debit';
    } else if (credit > 0) {
      amount = credit;
      direction = 'credit';
    } else if (amountCol >= 0) {
      const raw = cols[amountCol] ?? '';
      const signed = parseAmount(raw);
      direction = signed < 0 || raw.includes('(') ? 'debit' : 'credit';
      amount = Math.abs(signed);
    }
    if (amount <= 0) continue;
    out.push({
      transactionDate: normalizeIsoDate(cols[dateCol]),
      valueDate: valueDateCol >= 0 ? normalizeIsoDate(cols[valueDateCol]) : undefined,
      amountPkr: amount,
      direction,
      description: cols[descCol] ?? '',
      counterparty: partyCol >= 0 ? cols[partyCol] : undefined,
      referenceNumber: refCol >= 0 ? cols[refCol] : undefined,
    });
  }
  return { rows: out, format };
}

export interface ImportStatementCsvInput {
  accountId: string;
  csvText: string;
  statementUrl?: string;
}

export async function importStatementCsv(input: ImportStatementCsvInput): Promise<Result<{ id: string; statementId: string; imported: number; format: BankFormat }>> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };

  const [acct] = await db.select().from(bankAccounts).where(eq(bankAccounts.id, input.accountId)).limit(1);
  if (!acct) return { ok: false, error: 'Account not found' };

  const { rows, format } = parseCsv(input.csvText);
  if (rows.length === 0) return { ok: false, error: 'No valid rows parsed' };

  const txnInserts = rows.map((r) => ({
    accountId: input.accountId,
    transactionDate: r.transactionDate,
    valueDate: r.valueDate,
    amountPkr: r.amountPkr.toFixed(2),
    direction: r.direction,
    description: r.description || '(no description)',
    counterparty: r.counterparty ?? null,
    referenceNumber: r.referenceNumber ?? null,
    rawJsonb: r as unknown as Record<string, unknown>,
  }));
  const inserted = await db.insert(bankTransactions).values(txnInserts).returning({ id: bankTransactions.id });

  const dates = rows.map((r) => r.transactionDate).sort();
  const credits = rows.filter((r) => r.direction === 'credit').reduce((s, r) => s + r.amountPkr, 0);
  const debits = rows.filter((r) => r.direction === 'debit').reduce((s, r) => s + r.amountPkr, 0);

  const [stmt] = await db
    .insert(bankStatements)
    .values({
      accountId: input.accountId,
      periodStart: dates[0]!,
      periodEnd: dates[dates.length - 1]!,
      openingBalancePkr: Number(acct.openingBalancePkr).toFixed(2),
      closingBalancePkr: (Number(acct.openingBalancePkr) + credits - debits).toFixed(2),
      totalCreditsPkr: credits.toFixed(2),
      totalDebitsPkr: debits.toFixed(2),
      transactionCount: rows.length,
      statementUrl: input.statementUrl,
      importedBy: ctx.userId,
    })
    .returning();

  // Kick off auto-match in same request so reconciliation page shows fresh state
  await autoMatch(stmt!.id);

  revalidatePath('/finance/banking/reconciliation');
  revalidatePath('/finance/banking/statements/import');
  return { ok: true, id: input.accountId, statementId: stmt!.id, imported: inserted.length, format };
}

export interface ImportStatementPdfInput {
  accountId: string;
  parsedRows: ParsedRow[];
  statementUrl?: string;
}

/**
 * PDF import: caller passes pre-parsed rows from Claude vision OCR. Wiring
 * the actual OCR call lives in the upload UI layer.
 */
export async function importStatementPdf(input: ImportStatementPdfInput): Promise<Result<{ statementId: string; imported: number }>> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  if (input.parsedRows.length === 0) return { ok: false, error: 'No rows parsed from PDF' };

  const [acct] = await db.select().from(bankAccounts).where(eq(bankAccounts.id, input.accountId)).limit(1);
  if (!acct) return { ok: false, error: 'Account not found' };

  await db.insert(bankTransactions).values(
    input.parsedRows.map((r) => ({
      accountId: input.accountId,
      transactionDate: r.transactionDate,
      valueDate: r.valueDate,
      amountPkr: r.amountPkr.toFixed(2),
      direction: r.direction,
      description: r.description || '(no description)',
      counterparty: r.counterparty ?? null,
      referenceNumber: r.referenceNumber ?? null,
      rawJsonb: r as unknown as Record<string, unknown>,
    })),
  );

  const dates = input.parsedRows.map((r) => r.transactionDate).sort();
  const credits = input.parsedRows.filter((r) => r.direction === 'credit').reduce((s, r) => s + r.amountPkr, 0);
  const debits = input.parsedRows.filter((r) => r.direction === 'debit').reduce((s, r) => s + r.amountPkr, 0);

  const [stmt] = await db
    .insert(bankStatements)
    .values({
      accountId: input.accountId,
      periodStart: dates[0]!,
      periodEnd: dates[dates.length - 1]!,
      openingBalancePkr: Number(acct.openingBalancePkr).toFixed(2),
      closingBalancePkr: (Number(acct.openingBalancePkr) + credits - debits).toFixed(2),
      totalCreditsPkr: credits.toFixed(2),
      totalDebitsPkr: debits.toFixed(2),
      transactionCount: input.parsedRows.length,
      statementUrl: input.statementUrl,
      importedBy: ctx.userId,
    })
    .returning();

  await autoMatch(stmt!.id);
  revalidatePath('/finance/banking/reconciliation');
  return { ok: true, statementId: stmt!.id, imported: input.parsedRows.length };
}

export interface CreatePaymentOrderInput {
  fromAccountId: string;
  payeeName: string;
  payeeAccount?: string;
  payeeIban?: string;
  payeeBank?: string;
  payeeCnic?: string;
  amountPkr: number;
  paymentKind: 'vendor_payment' | 'salary' | 'tax' | 'loan_repayment' | 'utility' | 'rent' | 'refund' | 'other';
  scheduledFor?: string;
  relatedInvoiceId?: string;
  relatedPayrollRunId?: string;
}

export async function createPaymentOrder(input: CreatePaymentOrderInput): Promise<Result> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  if (input.amountPkr <= 0) return { ok: false, error: 'Amount must be positive' };
  if (!input.payeeAccount && !input.payeeIban) return { ok: false, error: 'Provide a payee account or IBAN' };

  const [acct] = await db.select().from(bankAccounts).where(eq(bankAccounts.id, input.fromAccountId)).limit(1);
  if (!acct) return { ok: false, error: 'From-account not found' };

  const [po] = await db
    .insert(paymentOrders)
    .values({
      entityId: acct.entityId,
      fromAccountId: input.fromAccountId,
      payeeName: input.payeeName,
      payeeAccount: input.payeeAccount,
      payeeIban: input.payeeIban,
      payeeBank: input.payeeBank,
      payeeCnic: input.payeeCnic,
      amountPkr: input.amountPkr.toFixed(2),
      paymentKind: input.paymentKind,
      scheduledFor: input.scheduledFor,
      relatedInvoiceId: input.relatedInvoiceId,
      relatedPayrollRunId: input.relatedPayrollRunId,
      createdBy: ctx.userId,
      status: 'pending_approval',
    })
    .returning();

  const payload = {
    paymentOrderId: po!.id,
    fromAccountId: input.fromAccountId,
    bankName: acct.bankName,
    accountTitle: acct.accountTitle,
    payeeName: input.payeeName,
    amountPkr: input.amountPkr,
    paymentKind: input.paymentKind,
    scheduledFor: input.scheduledFor,
  };

  const contextSnapshot = await buildFullContext({
    entityId: acct.entityId,
    approvalType: 'bank_payment',
    payload: payload as Record<string, unknown>,
    requesterUserId: ctx.userId,
    sourceModule: 'banking',
  });

  const approvalRequestId = await submitApproval({
    entityId: acct.entityId,
    approvalType: 'bank_payment',
    sourceModule: 'banking',
    sourceRecordId: po!.id,
    title: `Pay ${input.payeeName} from ${acct.bankName}`,
    amountPkr: input.amountPkr,
    payload,
    contextSnapshot,
    requestedBy: ctx.userId,
    actorRole: ctx.role,
  });

  await db.update(paymentOrders).set({ approvalRequestId }).where(eq(paymentOrders.id, po!.id));

  revalidatePath('/finance/banking/payments/new');
  revalidatePath('/finance/banking/dashboard');
  return { ok: true, id: po!.id };
}

export interface ManualMatchInput {
  transactionId: string;
  journalEntryId?: string;
  kind: 'journal_entry' | 'ar_receipt' | 'ap_payment' | 'loan_disbursement' | 'loan_payment' | 'tax_payment' | 'salary' | 'manual';
  matchedToId?: string;
}

export async function manualMatchTransaction(input: ManualMatchInput): Promise<Result> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  await db
    .update(bankTransactions)
    .set({
      matchedToKind: input.kind,
      matchedToId: input.matchedToId ?? input.journalEntryId ?? null,
      matchedAt: new Date(),
      matchedBy: ctx.userId,
      status: 'manual_reviewed',
    })
    .where(eq(bankTransactions.id, input.transactionId));
  revalidatePath('/finance/banking/reconciliation');
  return { ok: true, id: input.transactionId };
}

export async function runAutoMatchFor(statementId: string): Promise<Result<{ matched: number; flagged: number; unmatched: number }>> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  const r = await autoMatch(statementId);
  revalidatePath('/finance/banking/reconciliation');
  return { ok: true, id: statementId, matched: r.matchedCount, flagged: r.flaggedCount, unmatched: r.unmatchedCount };
}
