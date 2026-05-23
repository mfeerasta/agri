import ExcelJS from 'exceljs';
import { writeHeader, writeSection, writeTotalRow } from './xlsx-helpers.js';
import type { BalanceSheet } from '../types.js';

export interface BalanceSheetXlsxOpts {
  entityName: string;
  data: BalanceSheet;
}

export async function buildBalanceSheetXlsx(opts: BalanceSheetXlsxOpts): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Zameen';
  wb.created = new Date();
  const ws = wb.addWorksheet('Balance Sheet');
  writeHeader(ws, 'Balance Sheet', 'گوشوارہ مالیات', `As of · بتاریخ ${opts.data.asOf}`, opts.entityName);
  let row = 5;
  row = writeSection(ws, opts.data.assets, row);
  row = writeSection(ws, opts.data.liabilities, row);
  row = writeSection(ws, opts.data.equity, row);
  row = writeTotalRow(ws, row, { en: 'Total Liabilities + Equity', ur: 'کل واجبات + سرمایہ' }, opts.data.totalLiabEqRupees);
  row = writeTotalRow(ws, row, { en: 'Total Assets', ur: 'کل اثاثے' }, opts.data.assets.subtotalRupees);
  if (!opts.data.balanced) {
    ws.getCell(`A${row + 1}`).value = `Balance check failed by Rs. ${(opts.data.assets.subtotalRupees - opts.data.totalLiabEqRupees).toFixed(2)}`;
    ws.getCell(`A${row + 1}`).font = { color: { argb: 'FFB00020' }, italic: true };
  }
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf as ArrayBuffer);
}
