import { describe, it, expect, vi, beforeEach } from 'vitest';

// In-memory stand-in for the drizzle db used by journal.ts.
// We model just enough to let postJournal + reverseJournal run end-to-end.
interface AccountRow {
  id: string;
  entityId: string;
  code: string;
}
interface JournalEntryRow {
  id: string;
  entityId: string;
  journalNumber: string;
  postedOn: string;
  narration: string;
  sourceModule: string | null;
  sourceRecordId: string | null;
  approvalRequestId: string | null;
  totalDebitPkr: string;
  totalCreditPkr: string;
  postedBy: string | null;
  reversedById: string | null;
}
interface JournalLineRow {
  id: string;
  journalEntryId: string;
  accountId: string;
  debitPkr: string;
  creditPkr: string;
  fieldId: string | null;
  cropPlanId: string | null;
  assetId: string | null;
  costPool: string | null;
  narration: string | null;
}

const ENTITY = 'entity-1';
const accountsTable: AccountRow[] = [
  { id: 'acc-1', entityId: ENTITY, code: '1000' }, // Cash
  { id: 'acc-2', entityId: ENTITY, code: '5000' }, // Expense
];
const entries: JournalEntryRow[] = [];
const lines: JournalLineRow[] = [];

let entryCounter = 0;
let lineCounter = 0;

function makeChain<T>(rows: T[]) {
  // chain: select().from(table).where(...).limit(n)
  const chain: any = {
    from: () => chain,
    where: () => chain,
    limit: () => Promise.resolve(rows),
    groupBy: () => Promise.resolve(rows),
    then: (resolve: (v: T[]) => unknown) => resolve(rows),
  };
  return chain;
}

vi.mock('@zameen/db', () => {
  // Table sentinels — value-equality used in mock branching.
  const accountsT = { __t: 'accounts' };
  const journalEntriesT = { __t: 'journalEntries' };
  const journalLinesT = { __t: 'journalLines' };

  const db = {
    select: () => ({
      from: (t: any) => {
        if (t === accountsT) {
          return {
            where: () => Promise.resolve(accountsTable),
            then: (r: (v: AccountRow[]) => unknown) => r(accountsTable),
            limit: () => Promise.resolve(accountsTable),
            // allow awaiting select().from(accounts) directly
            ...makeChain(accountsTable),
          };
        }
        if (t === journalEntriesT) {
          return {
            where: () => ({ limit: () => Promise.resolve(entries.slice(-1)) }),
          };
        }
        if (t === journalLinesT) {
          return {
            where: () => Promise.resolve(lines),
          };
        }
        return makeChain([]);
      },
    }),
    insert: (t: any) => ({
      values: (vals: any) => ({
        returning: () => {
          if (t === journalEntriesT) {
            const id = `je-${++entryCounter}`;
            const row: JournalEntryRow = {
              id,
              entityId: vals.entityId,
              journalNumber: vals.journalNumber,
              postedOn: vals.postedOn,
              narration: vals.narration,
              sourceModule: vals.sourceModule ?? null,
              sourceRecordId: vals.sourceRecordId ?? null,
              approvalRequestId: vals.approvalRequestId ?? null,
              totalDebitPkr: vals.totalDebitPkr,
              totalCreditPkr: vals.totalCreditPkr,
              postedBy: vals.postedBy ?? null,
              reversedById: null,
            };
            entries.push(row);
            return Promise.resolve([row]);
          }
          return Promise.resolve([]);
        },
        // for journalLines insert (no returning chained)
        then: (resolve: (v: unknown) => unknown) => {
          if (t === journalLinesT) {
            const arr = Array.isArray(vals) ? vals : [vals];
            for (const v of arr) {
              lines.push({
                id: `jl-${++lineCounter}`,
                journalEntryId: v.journalEntryId,
                accountId: v.accountId,
                debitPkr: v.debitPkr,
                creditPkr: v.creditPkr,
                fieldId: v.fieldId ?? null,
                cropPlanId: v.cropPlanId ?? null,
                assetId: v.assetId ?? null,
                costPool: v.costPool ?? null,
                narration: v.narration ?? null,
              });
            }
          }
          return resolve(undefined);
        },
      }),
    }),
    update: (_t: any) => ({
      set: () => ({ where: () => Promise.resolve(undefined) }),
    }),
  };

  return {
    db,
    accounts: accountsT,
    journalEntries: journalEntriesT,
    journalLines: journalLinesT,
  };
});

vi.mock('drizzle-orm', () => ({
  eq: () => ({}),
  and: () => ({}),
  sql: () => ({}),
}));

import { postJournal, reverseJournal } from '../journal.js';

beforeEach(() => {
  entries.length = 0;
  lines.length = 0;
  entryCounter = 0;
  lineCounter = 0;
});

describe('postJournal', () => {
  it('posts a balanced journal entry', async () => {
    const id = await postJournal({
      entityId: ENTITY,
      postedOn: '2026-05-17',
      narration: 'test',
      sourceModule: 'diesel',
      journalNumber: 'JE-1',
      lines: [
        { accountCode: '5000', debitPkr: 100 },
        { accountCode: '1000', creditPkr: 100 },
      ],
    });
    expect(id).toBe('je-1');
    expect(entries).toHaveLength(1);
    expect(entries[0]!.totalDebitPkr).toBe('100.00');
    expect(entries[0]!.totalCreditPkr).toBe('100.00');
    expect(lines).toHaveLength(2);
  });

  it('throws on unbalanced journal', async () => {
    await expect(
      postJournal({
        entityId: ENTITY,
        postedOn: '2026-05-17',
        narration: 'bad',
        sourceModule: 'diesel',
        journalNumber: 'JE-2',
        lines: [
          { accountCode: '5000', debitPkr: 100 },
          { accountCode: '1000', creditPkr: 90 },
        ],
      }),
    ).rejects.toThrow(/Unbalanced journal/);
  });

  it('throws on unknown account code', async () => {
    await expect(
      postJournal({
        entityId: ENTITY,
        postedOn: '2026-05-17',
        narration: 'bad code',
        sourceModule: 'diesel',
        journalNumber: 'JE-3',
        lines: [
          { accountCode: '9999', debitPkr: 50 },
          { accountCode: '1000', creditPkr: 50 },
        ],
      }),
    ).rejects.toThrow(/Account code 9999/);
  });
});

describe('reverseJournal', () => {
  it('reversal swaps debits and credits', async () => {
    await postJournal({
      entityId: ENTITY,
      postedOn: '2026-05-17',
      narration: 'original',
      sourceModule: 'diesel',
      journalNumber: 'JE-100',
      lines: [
        { accountCode: '5000', debitPkr: 250 },
        { accountCode: '1000', creditPkr: 250 },
      ],
    });
    const original = entries[0]!;
    const reversedId = await reverseJournal(original.id, 'fixup');
    expect(reversedId).toBe('je-2');
    const revLines = lines.filter((l) => l.journalEntryId === reversedId);
    expect(revLines).toHaveLength(2);
    // Original debit on 5000 (acc-2) becomes credit on 5000 in reversal.
    const acc2Line = revLines.find((l) => l.accountId === 'acc-2')!;
    expect(acc2Line.creditPkr).toBe('250.00');
    expect(acc2Line.debitPkr).toBe('0.00');
    const acc1Line = revLines.find((l) => l.accountId === 'acc-1')!;
    expect(acc1Line.debitPkr).toBe('250.00');
    expect(acc1Line.creditPkr).toBe('0.00');
  });
});
