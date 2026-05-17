import {
  newWorkbook,
  addBrandedHeader,
  applyTableHeader,
  addDataRow,
  workbookToBuffer,
  MONEY_FORMAT,
  type ColumnDef,
  type WorkbookHeader,
} from './excel-template';
import type { FieldMatrix } from './field-matrix';

export async function buildFieldMatrixXlsx(matrix: FieldMatrix, meta: WorkbookHeader): Promise<Buffer> {
  const wb = newWorkbook(meta);
  const ws = wb.addWorksheet('Matrix', { properties: { tabColor: { argb: 'FF1F4D2B' } } });
  addBrandedHeader(ws, meta, 2 + matrix.seasons.length);
  const cols: ColumnDef[] = [
    { header: 'Field', key: 'fieldCode', width: 12 },
    { header: 'Acres', key: 'acres', width: 10, align: 'right' },
    ...matrix.seasons.map((s) => ({
      header: s,
      key: `season_${s}`,
      width: 18,
      numFmt: MONEY_FORMAT,
      align: 'right' as const,
    })),
  ];
  applyTableHeader(ws, cols);
  for (const r of matrix.rows) {
    const row: Record<string, string | number | null> = {
      fieldCode: r.fieldCode,
      acres: r.acres,
    };
    for (const s of matrix.seasons) {
      row[`season_${s}`] = r.cells[s]?.marginPerAcre ?? null;
    }
    addDataRow(ws, cols, row);
  }
  return workbookToBuffer(wb);
}
