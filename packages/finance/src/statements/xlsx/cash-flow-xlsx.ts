import ExcelJS from 'exceljs';
import { PKR_FORMAT, writeHeader, writeSection, writeTotalRow } from './xlsx-helpers.js';
import type { CashFlowStatement } from '../types.js';

export interface CashFlowXlsxOpts {
  entityName: string;
  data: CashFlowStatement;
}

export async function buildCashFlowXlsx(opts: CashFlowXlsxOpts): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Zameen';
  wb.created = new Date();
  const ws = wb.addWorksheet('Cash Flow');
  writeHeader(
    ws,
    'Cash Flow Statement',
    'گوشوارہ نقدی',
    `${opts.data.periodStart} → ${opts.data.periodEnd}`,
    opts.entityName,
  );
  let row = 5;
  ws.getCell(`B${row}`).value = 'Opening Cash · ابتدائی نقدی';
  ws.getCell(`B${row}`).font = { bold: true };
  ws.getCell(`D${row}`).value = opts.data.openingCashRupees;
  ws.getCell(`D${row}`).numFmt = PKR_FORMAT;
  row += 2;
  row = writeSection(ws, opts.data.operating, row);
  row = writeSection(ws, opts.data.investing, row);
  row = writeSection(ws, opts.data.financing, row);
  row = writeTotalRow(ws, row, { en: 'Net Change in Cash', ur: 'نقدی میں خالص تبدیلی' }, opts.data.netChangeRupees);
  writeTotalRow(ws, row, { en: 'Closing Cash', ur: 'اختتامی نقدی' }, opts.data.closingCashRupees);
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf as ArrayBuffer);
}
