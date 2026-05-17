import { describe, it, expect, beforeEach } from 'vitest';
import { resetDb, seedDb, getRows } from '@zameen/db';
import { postJournal, reverseJournal } from '../journal.js';

const ENTITY = 'entity-1';

beforeEach(() => {
  resetDb();
  seedDb({
    accounts: [
      { id: 'acc-cash', entityId: ENTITY, code: '1000' },
      { id: 'acc-exp', entityId: ENTITY, code: '5000' },
    ],
  });
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
    expect(typeof id).toBe('string');
    const entries = getRows('journalEntries');
    expect(entries).toHaveLength(1);
    expect(entries[0]!.totalDebitPkr).toBe('100.00');
    expect(entries[0]!.totalCreditPkr).toBe('100.00');
    const lines = getRows('journalLines');
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
    const originalId = await postJournal({
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
    const reversedId = await reverseJournal(originalId, 'fixup');
    expect(reversedId).not.toBe(originalId);
    const revLines = getRows('journalLines').filter((l) => l.journalEntryId === reversedId);
    expect(revLines).toHaveLength(2);
    const expLine = revLines.find((l) => l.accountId === 'acc-exp')!;
    expect(expLine.creditPkr).toBe('250.00');
    expect(expLine.debitPkr).toBe('0.00');
    const cashLine = revLines.find((l) => l.accountId === 'acc-cash')!;
    expect(cashLine.debitPkr).toBe('250.00');
    expect(cashLine.creditPkr).toBe('0.00');
  });
});
