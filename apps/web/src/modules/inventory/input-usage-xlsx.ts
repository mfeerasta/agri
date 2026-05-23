import ExcelJS from 'exceljs';
import type { InputUsageLogData } from './input-usage-log-actions';

export async function renderInputUsageXlsx(
  data: InputUsageLogData,
  opts: { sheetName: string; sectionLabel: string },
): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(opts.sheetName);

  const headerRow: Array<string | number> = ['Date / تاریخ'];
  for (const f of data.fields) {
    headerRow.push(`${f.code} (${f.acres.toFixed(2)} ac)`);
  }
  headerRow.push('Day Total / دن کا کل');
  ws.addRow(headerRow);
  ws.getRow(1).font = { bold: true };

  for (const r of data.rows) {
    const row: Array<string | number> = [r.date];
    for (const f of data.fields) {
      const c = r.perField[f.id];
      row.push(c ? c.totalPkr : 0);
    }
    row.push(r.totalPkr);
    ws.addRow(row);
  }

  const totalRow: Array<string | number> = ['Field Total / کھیت کا کل'];
  for (const f of data.fields) {
    totalRow.push(data.fieldTotals[f.id] ?? 0);
  }
  totalRow.push(data.grandTotalPkr);
  const tr = ws.addRow(totalRow);
  tr.font = { bold: true };

  ws.addRow([]);
  ws.addRow([opts.sectionLabel]);
  for (const i of data.inputs) {
    ws.addRow([i.nameUr ? `${i.nameUr} / ${i.name}` : i.name, data.inputTotals[i.id] ?? 0]);
  }

  for (let i = 2; i <= ws.rowCount; i += 1) {
    for (let c = 2; c <= data.fields.length + 2; c += 1) {
      const cell = ws.getCell(i, c);
      if (typeof cell.value === 'number') cell.numFmt = '#,##0.00';
    }
  }

  ws.columns.forEach((col) => {
    col.width = 18;
  });

  return wb.xlsx.writeBuffer() as Promise<ArrayBuffer>;
}
