import { describe, it, expect, beforeEach } from 'vitest';
import { resetDb, seedDb } from '@zameen/db';
import { payrollDivisorFor, computeNetPay } from '../payroll-divisor.js';

const AGRI = 'entity-agri';
const RFB = 'entity-rfb';
const ZP = 'entity-zp';

beforeEach(() => {
  resetDb();
  seedDb({
    entities: [
      { id: AGRI, code: 'AGRI', name: 'AGRI' },
      { id: RFB, code: 'RFB', name: 'RFB' },
      { id: ZP, code: 'ZP', name: 'ZP' },
    ],
  });
});

describe('payrollDivisorFor', () => {
  it('AGRI uses flat 30 divisor', async () => {
    const d = await payrollDivisorFor(AGRI);
    expect(d.kind).toBe('flat_30');
    expect(d.divisorForPeriod('2026-05-01', '2026-05-31')).toBe(30);
  });

  it('RFB uses actual calendar days', async () => {
    const d = await payrollDivisorFor(RFB);
    expect(d.kind).toBe('actual_calendar');
    expect(d.divisorForPeriod('2026-05-01', '2026-05-31')).toBe(31);
  });

  it('ZP uses flat 26 working days', async () => {
    const d = await payrollDivisorFor(ZP);
    expect(d.kind).toBe('flat_26');
    expect(d.divisorForPeriod('2026-05-01', '2026-05-26')).toBe(26);
  });
});

describe('computeNetPay', () => {
  it('combines base pay from monthly salary with piece-rate earnings and advances', async () => {
    seedDb({
      workers: [
        {
          id: 'w-1',
          entityId: AGRI,
          monthlySalaryPkr: '30000',
          dailyWagePkr: null,
        },
      ],
      attendanceRecords: [
        { id: 'a1', workerId: 'w-1', entityId: AGRI, workDate: '2026-05-01', status: 'present' },
        { id: 'a2', workerId: 'w-1', entityId: AGRI, workDate: '2026-05-02', status: 'present' },
        { id: 'a3', workerId: 'w-1', entityId: AGRI, workDate: '2026-05-03', status: 'half_day' },
        { id: 'a4', workerId: 'w-1', entityId: AGRI, workDate: '2026-05-04', status: 'absent' },
      ],
      pieceRateLogs: [
        { id: 'p1', workerId: 'w-1', workDate: '2026-05-02', totalPkr: '500' },
        { id: 'p2', workerId: 'w-1', workDate: '2026-05-03', totalPkr: '750' },
      ],
    });

    const out = await computeNetPay({
      workerId: 'w-1',
      periodStart: '2026-05-01',
      periodEnd: '2026-05-31',
      advancesPkr: 1_000,
      deductionsPkr: 200,
    });

    expect(out.daysPresent).toBe(2.5);
    expect(out.divisor).toBe(30);
    // 30000/30 = 1000 per day; 2.5 days => 2500
    expect(out.baseSalaryPkr).toBe(2500);
    expect(out.pieceRateEarningsPkr).toBe(1250);
    expect(out.advancesPkr).toBe(1000);
    expect(out.deductionsPkr).toBe(200);
    // 2500 + 1250 - 1000 - 200 = 2550
    expect(out.netPkr).toBe(2550);
  });

  it('falls back to daily wage when no monthly salary set', async () => {
    seedDb({
      workers: [
        { id: 'w-2', entityId: AGRI, dailyWagePkr: '800', monthlySalaryPkr: null },
      ],
      attendanceRecords: [
        { id: 'b1', workerId: 'w-2', entityId: AGRI, workDate: '2026-05-01', status: 'present' },
        { id: 'b2', workerId: 'w-2', entityId: AGRI, workDate: '2026-05-02', status: 'present' },
      ],
      pieceRateLogs: [],
    });
    const out = await computeNetPay({
      workerId: 'w-2',
      periodStart: '2026-05-01',
      periodEnd: '2026-05-31',
    });
    expect(out.baseSalaryPkr).toBe(1600);
    expect(out.netPkr).toBe(1600);
  });

  it('throws for unknown worker id', async () => {
    await expect(
      computeNetPay({ workerId: 'missing', periodStart: '2026-05-01', periodEnd: '2026-05-31' }),
    ).rejects.toThrow(/not found/);
  });
});
