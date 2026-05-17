import ExcelJS from 'exceljs';

export const BRAND_EXCEL = {
  greenArgb: 'FF1F4D2B',
  greenSoftArgb: 'FF386C47',
  ochreArgb: 'FFB9802C',
  inkArgb: 'FF1A1A1A',
  paperArgb: 'FFFBF6EC',
  paper2Argb: 'FFF1EAD8',
  ruleArgb: 'FFCFC6B6',
} as const;

export const MONEY_FORMAT = '"Rs."#,##0.00;[Red]"Rs."(#,##0.00)';
export const QTY_FORMAT = '#,##0.00;[Red](#,##0.00)';
export const DATE_FORMAT = 'dd-mmm-yyyy';
export const DATETIME_FORMAT = 'dd-mmm-yyyy hh:mm';

export interface WorkbookHeader {
  reportTitle: string;
  entityName: string;
  period: string;
  generatedAt: Date;
  generatedBy: string;
}

export function newWorkbook(meta: WorkbookHeader): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Zameen';
  wb.lastModifiedBy = meta.generatedBy;
  wb.created = meta.generatedAt;
  wb.modified = meta.generatedAt;
  wb.title = meta.reportTitle;
  wb.subject = `${meta.entityName}, ${meta.period}`;
  wb.company = 'Rupafab Agri';
  return wb;
}

export function addBrandedHeader(ws: ExcelJS.Worksheet, meta: WorkbookHeader, colSpan: number): void {
  const titleRow = ws.addRow(['RUPAFAB AGRI, ZAMEEN OPERATIONS']);
  titleRow.height = 22;
  titleRow.font = { name: 'Inter', size: 14, bold: true, color: { argb: BRAND_EXCEL.greenArgb } };
  ws.mergeCells(titleRow.number, 1, titleRow.number, colSpan);

  const subRow = ws.addRow([meta.reportTitle]);
  subRow.height = 18;
  subRow.font = { name: 'Inter', size: 11, bold: true, color: { argb: BRAND_EXCEL.inkArgb } };
  ws.mergeCells(subRow.number, 1, subRow.number, colSpan);

  const metaRow = ws.addRow([
    `${meta.entityName}  |  Period: ${meta.period}  |  Generated ${formatDateLocal(meta.generatedAt)} by ${meta.generatedBy}`,
  ]);
  metaRow.font = { name: 'Inter', size: 9, color: { argb: BRAND_EXCEL.greenSoftArgb }, italic: true };
  ws.mergeCells(metaRow.number, 1, metaRow.number, colSpan);

  ws.addRow([]); // gap row
}

export interface ColumnDef {
  header: string;
  key: string;
  width?: number;
  numFmt?: string;
  align?: 'left' | 'right' | 'center';
}

export function applyTableHeader(ws: ExcelJS.Worksheet, columns: ColumnDef[]): number {
  ws.columns = columns.map((c) => ({
    header: c.header,
    key: c.key,
    width: c.width ?? 16,
    style: { numFmt: c.numFmt, alignment: c.align ? { horizontal: c.align } : undefined },
  }));
  // The columns assignment also writes header row 1, but we already wrote brand header rows.
  // Reset and append header manually.
  ws.spliceRows(ws.rowCount, 1);
  const headerRow = ws.addRow(columns.map((c) => c.header));
  headerRow.font = { name: 'Inter', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.alignment = { vertical: 'middle' };
  headerRow.height = 20;
  headerRow.eachCell((cell, colNumber) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_EXCEL.greenArgb } };
    cell.border = {
      top: { style: 'thin', color: { argb: BRAND_EXCEL.greenArgb } },
      bottom: { style: 'thin', color: { argb: BRAND_EXCEL.greenArgb } },
      left: { style: 'hair', color: { argb: BRAND_EXCEL.ruleArgb } },
      right: { style: 'hair', color: { argb: BRAND_EXCEL.ruleArgb } },
    };
    const def = columns[colNumber - 1];
    if (def?.align) cell.alignment = { horizontal: def.align, vertical: 'middle' };
  });
  ws.views = [{ state: 'frozen', ySplit: headerRow.number }];
  return headerRow.number;
}

export function addDataRow(
  ws: ExcelJS.Worksheet,
  columns: ColumnDef[],
  row: Record<string, string | number | Date | null | undefined>,
): ExcelJS.Row {
  const r = ws.addRow(columns.map((c) => row[c.key] ?? null));
  r.font = { name: 'Inter', size: 10 };
  r.alignment = { vertical: 'middle' };
  r.eachCell((cell, colNumber) => {
    const def = columns[colNumber - 1];
    if (!def) return;
    if (def.numFmt) cell.numFmt = def.numFmt;
    if (def.align) cell.alignment = { horizontal: def.align, vertical: 'middle' };
    cell.border = {
      bottom: { style: 'hair', color: { argb: BRAND_EXCEL.ruleArgb } },
    };
  });
  return r;
}

export function addTotalsRow(
  ws: ExcelJS.Worksheet,
  columns: ColumnDef[],
  totals: Record<string, string | number | null | undefined>,
  labelKey = columns[0]?.key,
  labelText = 'TOTAL',
): ExcelJS.Row {
  const data: Record<string, string | number | null | undefined> = { ...totals };
  if (labelKey && !data[labelKey]) data[labelKey] = labelText;
  const r = ws.addRow(columns.map((c) => data[c.key] ?? null));
  r.font = { name: 'Inter', size: 10, bold: true, color: { argb: BRAND_EXCEL.greenArgb } };
  r.eachCell((cell, colNumber) => {
    const def = columns[colNumber - 1];
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_EXCEL.paperArgb } };
    cell.border = {
      top: { style: 'medium', color: { argb: BRAND_EXCEL.greenArgb } },
      bottom: { style: 'thin', color: { argb: BRAND_EXCEL.greenArgb } },
    };
    if (def?.numFmt) cell.numFmt = def.numFmt;
    if (def?.align) cell.alignment = { horizontal: def.align, vertical: 'middle' };
  });
  return r;
}

export async function workbookToBuffer(wb: ExcelJS.Workbook): Promise<Buffer> {
  const ab = await wb.xlsx.writeBuffer();
  return Buffer.from(ab as ArrayBuffer);
}

export function formatDateLocal(d: Date): string {
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function buildXlsxFilename(slug: string, period: string): string {
  const safe = `${slug}-${period}`.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return `${safe}.xlsx`;
}

export function buildPdfFilename(slug: string, period: string): string {
  const safe = `${slug}-${period}`.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return `${safe}.pdf`;
}
