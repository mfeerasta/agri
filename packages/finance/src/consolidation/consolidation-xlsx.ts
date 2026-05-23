import ExcelJS from 'exceljs';
import { writeHeader, writeSection, writeTotalRow, PKR_FORMAT } from '../statements/xlsx/xlsx-helpers.js';
import type { ConsolidatedReport } from './consolidate.js';

export async function buildConsolidationXlsx(
  parentEntityName: string,
  report: ConsolidatedReport,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Zameen';
  wb.created = new Date();

  const periodLine = `Period ${report.periodStart} to ${report.periodEnd} | ${report.perEntity.length} entities | ${report.eliminationsApplied.length} eliminations`;

  // Consolidated balance sheet
  const bsSheet = wb.addWorksheet('Consolidated BS');
  writeHeader(bsSheet, 'Consolidated Balance Sheet', 'مجموعی گوشوارہ مالیات', periodLine, parentEntityName);
  let row = 5;
  row = writeSection(bsSheet, report.consolidated.balanceSheet.assets, row);
  row = writeSection(bsSheet, report.consolidated.balanceSheet.liabilities, row);
  row = writeSection(bsSheet, report.consolidated.balanceSheet.equity, row);
  writeTotalRow(
    bsSheet,
    row,
    { en: 'Total Liabilities + Equity', ur: 'کل واجبات + سرمایہ' },
    report.consolidated.balanceSheet.totalLiabEqRupees,
  );

  // Consolidated income statement
  const isSheet = wb.addWorksheet('Consolidated IS');
  writeHeader(isSheet, 'Consolidated Income Statement', 'مجموعی گوشوارہ آمدنی', periodLine, parentEntityName);
  let irow = 5;
  irow = writeSection(isSheet, report.consolidated.incomeStatement.revenue, irow);
  irow = writeSection(isSheet, report.consolidated.incomeStatement.expenses, irow);
  writeTotalRow(
    isSheet,
    irow,
    { en: 'Net Income', ur: 'خالص آمدنی' },
    report.consolidated.incomeStatement.netIncomeRupees,
  );

  // Consolidated cash flow
  const cfSheet = wb.addWorksheet('Consolidated CF');
  writeHeader(cfSheet, 'Consolidated Cash Flow', 'مجموعی بہاؤِ نقد', periodLine, parentEntityName);
  let crow = 5;
  crow = writeSection(cfSheet, report.consolidated.cashFlow.operating, crow);
  crow = writeSection(cfSheet, report.consolidated.cashFlow.investing, crow);
  crow = writeSection(cfSheet, report.consolidated.cashFlow.financing, crow);
  writeTotalRow(
    cfSheet,
    crow,
    { en: 'Net Change in Cash', ur: 'نقد میں خالص تبدیلی' },
    report.consolidated.cashFlow.netChangeRupees,
  );

  // Per-entity drilldown sheet
  const drillSheet = wb.addWorksheet('Per Entity');
  drillSheet.getRow(1).values = ['Entity', 'Method', 'Ownership %', 'Total Assets', 'Net Income', 'Net Cash Change'];
  drillSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  drillSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B4332' } };
  drillSheet.getColumn(1).width = 28;
  drillSheet.getColumn(2).width = 14;
  drillSheet.getColumn(3).width = 14;
  drillSheet.getColumn(4).width = 20;
  drillSheet.getColumn(5).width = 20;
  drillSheet.getColumn(6).width = 20;
  report.perEntity.forEach((p, i) => {
    const r = i + 2;
    drillSheet.getCell(`A${r}`).value = `${p.entityCode} ${p.entityName}`;
    drillSheet.getCell(`B${r}`).value = p.method;
    drillSheet.getCell(`C${r}`).value = p.ownershipPct;
    drillSheet.getCell(`D${r}`).value = p.balanceSheet.assets.subtotalRupees;
    drillSheet.getCell(`D${r}`).numFmt = PKR_FORMAT;
    drillSheet.getCell(`E${r}`).value = p.incomeStatement.netIncomeRupees;
    drillSheet.getCell(`E${r}`).numFmt = PKR_FORMAT;
    drillSheet.getCell(`F${r}`).value = p.cashFlow.netChangeRupees;
    drillSheet.getCell(`F${r}`).numFmt = PKR_FORMAT;
  });

  // Eliminations sheet
  const elimSheet = wb.addWorksheet('Eliminations');
  elimSheet.getRow(1).values = ['From', 'To', 'Kind', 'Amount (PKR)', 'Description'];
  elimSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  elimSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B4332' } };
  elimSheet.getColumn(1).width = 28;
  elimSheet.getColumn(2).width = 28;
  elimSheet.getColumn(3).width = 14;
  elimSheet.getColumn(4).width = 20;
  elimSheet.getColumn(5).width = 40;
  report.eliminationsApplied.forEach((e, i) => {
    const r = i + 2;
    elimSheet.getCell(`A${r}`).value = e.fromEntityId;
    elimSheet.getCell(`B${r}`).value = e.toEntityId;
    elimSheet.getCell(`C${r}`).value = e.kind ?? '';
    elimSheet.getCell(`D${r}`).value = e.amountPkr;
    elimSheet.getCell(`D${r}`).numFmt = PKR_FORMAT;
    elimSheet.getCell(`E${r}`).value = e.description;
  });

  return (await wb.xlsx.writeBuffer()) as Buffer;
}
