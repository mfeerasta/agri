import ExcelJS from 'exceljs';
import { writeHeader, writeSection, writeTotalRow } from './xlsx-helpers.js';
import type { IncomeStatement } from '../types.js';

export interface IncomeStatementXlsxOpts {
  entityName: string;
  data: IncomeStatement;
}

export async function buildIncomeStatementXlsx(opts: IncomeStatementXlsxOpts): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Zameen';
  wb.created = new Date();
  const ws = wb.addWorksheet('Income Statement');
  writeHeader(
    ws,
    'Income Statement',
    'نفع و نقصان',
    `${opts.data.periodStart} → ${opts.data.periodEnd}`,
    opts.entityName,
  );
  let row = 5;
  row = writeSection(ws, opts.data.revenue, row);
  row = writeSection(ws, opts.data.expenses, row);
  const label = opts.data.netIncomeRupees >= 0
    ? { en: 'Net Income', ur: 'خالص منافع' }
    : { en: 'Net Loss', ur: 'خالص نقصان' };
  writeTotalRow(ws, row, label, opts.data.netIncomeRupees);
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf as ArrayBuffer);
}
