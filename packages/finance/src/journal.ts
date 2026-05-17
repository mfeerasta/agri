import { eq } from 'drizzle-orm';
import { db, accounts, journalEntries, journalLines } from '@zameen/db';

export interface JournalLineInput {
  accountCode: string;
  debitPkr?: number;
  creditPkr?: number;
  fieldId?: string;
  cropPlanId?: string;
  assetId?: string;
  costPool?: string;
  narration?: string;
}

export interface PostJournalInput {
  entityId: string;
  postedOn: string;
  narration: string;
  sourceModule: string;
  sourceRecordId?: string;
  approvalRequestId?: string;
  postedBy?: string;
  journalNumber: string;
  lines: JournalLineInput[];
}

/**
 * Post a balanced journal entry. Throws if debits != credits.
 *
 * Every line must reference an account by code. The function resolves
 * account ids per-entity. Drift between debits and credits is rejected.
 */
export async function postJournal(input: PostJournalInput): Promise<string> {
  const totalDebit = input.lines.reduce((a, l) => a + (l.debitPkr ?? 0), 0);
  const totalCredit = input.lines.reduce((a, l) => a + (l.creditPkr ?? 0), 0);
  if (Math.abs(totalDebit - totalCredit) > 0.005) {
    throw new Error(`Unbalanced journal: debit ${totalDebit} != credit ${totalCredit}`);
  }

  const codeSet = Array.from(new Set(input.lines.map((l) => l.accountCode)));
  const accountRows = await db.select().from(accounts);
  const byCode = new Map(
    accountRows.filter((a) => a.entityId === input.entityId && codeSet.includes(a.code)).map((a) => [a.code, a.id]),
  );
  for (const code of codeSet) {
    if (!byCode.has(code)) throw new Error(`Account code ${code} not in chart of accounts for entity ${input.entityId}`);
  }

  const [entry] = await db
    .insert(journalEntries)
    .values({
      entityId: input.entityId,
      journalNumber: input.journalNumber,
      postedOn: input.postedOn,
      narration: input.narration,
      sourceModule: input.sourceModule,
      sourceRecordId: input.sourceRecordId,
      approvalRequestId: input.approvalRequestId,
      totalDebitPkr: totalDebit.toFixed(2),
      totalCreditPkr: totalCredit.toFixed(2),
      postedBy: input.postedBy,
    })
    .returning();

  await db.insert(journalLines).values(
    input.lines.map((l) => ({
      journalEntryId: entry!.id,
      accountId: byCode.get(l.accountCode)!,
      debitPkr: (l.debitPkr ?? 0).toFixed(2),
      creditPkr: (l.creditPkr ?? 0).toFixed(2),
      fieldId: l.fieldId,
      cropPlanId: l.cropPlanId,
      assetId: l.assetId,
      costPool: l.costPool,
      narration: l.narration,
    })),
  );

  return entry!.id;
}

export async function reverseJournal(journalEntryId: string, reason: string): Promise<string> {
  const [orig] = await db.select().from(journalEntries).where(eq(journalEntries.id, journalEntryId)).limit(1);
  if (!orig) throw new Error('Journal not found');
  const lines = await db.select().from(journalLines).where(eq(journalLines.journalEntryId, journalEntryId));
  const accountRows = await db.select().from(accounts).where(eq(accounts.entityId, orig.entityId));
  const idToCode = new Map(accountRows.map((a) => [a.id, a.code]));
  const reversedId = await postJournal({
    entityId: orig.entityId,
    postedOn: new Date().toISOString().slice(0, 10),
    narration: `Reversal of ${orig.journalNumber}: ${reason}`,
    sourceModule: orig.sourceModule ?? 'reversal',
    sourceRecordId: orig.id,
    journalNumber: `${orig.journalNumber}-REV`,
    lines: lines.map((l) => ({
      accountCode: idToCode.get(l.accountId)!,
      debitPkr: Number(l.creditPkr),
      creditPkr: Number(l.debitPkr),
      fieldId: l.fieldId ?? undefined,
      cropPlanId: l.cropPlanId ?? undefined,
      assetId: l.assetId ?? undefined,
      costPool: l.costPool ?? undefined,
      narration: l.narration ?? undefined,
    })),
  });
  await db.update(journalEntries).set({ reversedById: reversedId }).where(eq(journalEntries.id, journalEntryId));
  return reversedId;
}
