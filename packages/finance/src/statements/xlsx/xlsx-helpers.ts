import type { Worksheet } from 'exceljs';
import type { BilingualLabel, StatementSection } from '../types.js';

export const PKR_FORMAT = '"Rs." #,##0.00;[Red]"-Rs." #,##0.00';

export function writeHeader(ws: Worksheet, titleEn: string, titleUr: string, periodLine: string, entityName: string): void {
  ws.mergeCells('A1:D1');
  ws.getCell('A1').value = entityName;
  ws.getCell('A1').font = { bold: true, size: 14, color: { argb: 'FF1B4332' } };
  ws.mergeCells('A2:D2');
  ws.getCell('A2').value = `${titleEn}  ·  ${titleUr}`;
  ws.getCell('A2').font = { bold: true, size: 12, color: { argb: 'FF1B4332' } };
  ws.mergeCells('A3:D3');
  ws.getCell('A3').value = periodLine;
  ws.getCell('A3').font = { italic: true, color: { argb: 'FF555555' } };
  ws.getColumn(1).width = 12;
  ws.getColumn(2).width = 38;
  ws.getColumn(3).width = 22;
  ws.getColumn(4).width = 22;
  ws.getRow(4).values = ['Code', 'Account (EN)', 'Account (UR)', 'Amount (PKR)'];
  ws.getRow(4).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ws.getRow(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B4332' } };
}

export function writeSection(ws: Worksheet, section: StatementSection, startRow: number): number {
  let row = startRow;
  ws.getCell(`A${row}`).value = `${section.title.en}  ·  ${section.title.ur}`;
  ws.getCell(`A${row}`).font = { bold: true, color: { argb: 'FF1B4332' } };
  ws.mergeCells(`A${row}:D${row}`);
  row += 1;
  for (const line of section.lines) {
    ws.getCell(`A${row}`).value = line.accountCode ?? '';
    ws.getCell(`B${row}`).value = line.label.en;
    ws.getCell(`C${row}`).value = line.label.ur;
    ws.getCell(`D${row}`).value = line.amountRupees;
    ws.getCell(`D${row}`).numFmt = PKR_FORMAT;
    row += 1;
  }
  ws.getCell(`B${row}`).value = 'Subtotal · ذیلی کل';
  ws.getCell(`B${row}`).font = { bold: true };
  ws.getCell(`D${row}`).value = section.subtotalRupees;
  ws.getCell(`D${row}`).font = { bold: true };
  ws.getCell(`D${row}`).numFmt = PKR_FORMAT;
  ws.getRow(row).border = { top: { style: 'thin' } };
  row += 2;
  return row;
}

export function writeTotalRow(ws: Worksheet, row: number, label: BilingualLabel, amount: number): number {
  ws.getCell(`B${row}`).value = `${label.en}  ·  ${label.ur}`;
  ws.getCell(`B${row}`).font = { bold: true, size: 12 };
  ws.getCell(`D${row}`).value = amount;
  ws.getCell(`D${row}`).font = { bold: true, size: 12 };
  ws.getCell(`D${row}`).numFmt = PKR_FORMAT;
  ws.getRow(row).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7F3EC' } };
  ws.getRow(row).border = { top: { style: 'medium', color: { argb: 'FF1B4332' } } };
  return row + 1;
}
