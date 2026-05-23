import ExcelJS from 'exceljs';
import { PKR_FORMAT } from './xlsx-helpers.js';
import type { FieldPnL } from '../../field-pnl.js';

export interface FieldPnLXlsxOpts {
  entityName: string;
  fieldName?: string;
  data: FieldPnL;
}

export async function buildFieldPnLXlsx(opts: FieldPnLXlsxOpts): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Zameen';
  wb.created = new Date();
  const ws = wb.addWorksheet('Field P&L');
  ws.getColumn(1).width = 38;
  ws.getColumn(2).width = 22;
  ws.mergeCells('A1:B1');
  ws.getCell('A1').value = `${opts.entityName} · ${opts.fieldName ?? opts.data.fieldId}`;
  ws.getCell('A1').font = { bold: true, size: 14, color: { argb: 'FF1B4332' } };
  ws.mergeCells('A2:B2');
  ws.getCell('A2').value = 'Field P&L · کھیت کا نفع نقصان';
  ws.getCell('A2').font = { bold: true, size: 12, color: { argb: 'FF1B4332' } };

  let row = 4;
  ws.getCell(`A${row}`).value = 'Crop · فصل';
  ws.getCell(`B${row}`).value = opts.data.cropName;
  row += 1;
  ws.getCell(`A${row}`).value = 'Acres · ایکڑ';
  ws.getCell(`B${row}`).value = opts.data.acres;
  row += 1;
  ws.getCell(`A${row}`).value = 'Total yield (kg) · کل پیداوار';
  ws.getCell(`B${row}`).value = opts.data.yieldKg;
  row += 1;
  ws.getCell(`A${row}`).value = 'Yield per acre (kg) · فی ایکڑ';
  ws.getCell(`B${row}`).value = opts.data.yieldPerAcreKg;
  row += 2;

  ws.getCell(`A${row}`).value = 'Revenue · آمدنی';
  ws.getCell(`A${row}`).font = { bold: true };
  ws.getCell(`B${row}`).value = opts.data.revenuePkr;
  ws.getCell(`B${row}`).numFmt = PKR_FORMAT;
  row += 2;

  ws.getCell(`A${row}`).value = 'Cost by Pool · اخراجات';
  ws.getCell(`A${row}`).font = { bold: true };
  row += 1;
  for (const [pool, amt] of Object.entries(opts.data.costByPool)) {
    ws.getCell(`A${row}`).value = pool;
    ws.getCell(`B${row}`).value = amt;
    ws.getCell(`B${row}`).numFmt = PKR_FORMAT;
    row += 1;
  }
  ws.getCell(`A${row}`).value = 'Total cost · کل اخراجات';
  ws.getCell(`A${row}`).font = { bold: true };
  ws.getCell(`B${row}`).value = opts.data.totalCostPkr;
  ws.getCell(`B${row}`).numFmt = PKR_FORMAT;
  ws.getCell(`B${row}`).font = { bold: true };
  row += 2;

  ws.getCell(`A${row}`).value = opts.data.grossMarginPkr >= 0 ? 'Gross Margin · مجموعی منافع' : 'Gross Loss · مجموعی نقصان';
  ws.getCell(`A${row}`).font = { bold: true, size: 12 };
  ws.getCell(`B${row}`).value = opts.data.grossMarginPkr;
  ws.getCell(`B${row}`).numFmt = PKR_FORMAT;
  ws.getCell(`B${row}`).font = { bold: true, size: 12 };
  row += 1;
  ws.getCell(`A${row}`).value = 'Margin per acre · فی ایکڑ منافع';
  ws.getCell(`A${row}`).font = { bold: true };
  ws.getCell(`B${row}`).value = opts.data.marginPerAcrePkr;
  ws.getCell(`B${row}`).numFmt = PKR_FORMAT;

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf as ArrayBuffer);
}
