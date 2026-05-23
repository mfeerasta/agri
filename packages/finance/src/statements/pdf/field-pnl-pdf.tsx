import React from 'react';
import { Document, Page, Text, View } from '@react-pdf/renderer';
import { stmtStyles as s, fmtPkr } from './statement-styles.js';
import type { FieldPnL } from '../../field-pnl.js';

export interface FieldPnLPdfProps {
  entityName: string;
  entityNameUr?: string;
  data: FieldPnL;
  fieldName?: string;
}

export function FieldPnLPdf({ entityName, entityNameUr, fieldName, data }: FieldPnLPdfProps): React.JSX.Element {
  const poolRows = Object.entries(data.costByPool);
  return (
    <Document title={`Field P&L ${data.cropPlanId}`}>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <Text style={s.brand}>Zameen · Rupafab Agri</Text>
          <Text style={s.org}>{entityName}{entityNameUr ? `  ·  ${entityNameUr}` : ''}</Text>
          <View style={s.titleRow}>
            <Text style={s.titleEn}>Field P&L</Text>
            <Text style={s.titleUr}>کھیت کا نفع نقصان</Text>
          </View>
          <Text style={s.period}>Field: {fieldName ?? data.fieldId}  ·  Crop: {data.cropName}  ·  {data.acres.toFixed(2)} acres</Text>
        </View>

        <Text style={s.sectionTitle}>Yield · پیداوار</Text>
        <View style={s.row}><Text style={s.cellLabel}>Total yield (kg) · کل پیداوار</Text><Text style={s.cellAmount}>{data.yieldKg.toFixed(2)}</Text></View>
        <View style={s.row}><Text style={s.cellLabel}>Per acre (kg) · فی ایکڑ</Text><Text style={s.cellAmount}>{data.yieldPerAcreKg.toFixed(2)}</Text></View>

        <Text style={s.sectionTitle}>Revenue · آمدنی</Text>
        <View style={s.subtotalRow}><Text style={s.subtotalLabel}>Total revenue · کل آمدنی</Text><Text style={s.subtotalAmount}>{fmtPkr(data.revenuePkr)}</Text></View>

        <Text style={s.sectionTitle}>Cost by Pool · اخراجات</Text>
        {poolRows.map(([pool, amt], i) => (
          <View key={i} style={i % 2 === 0 ? s.row : s.rowAlt}>
            <Text style={s.cellLabel}>{pool}</Text>
            <Text style={s.cellAmount}>{fmtPkr(amt)}</Text>
          </View>
        ))}
        <View style={s.subtotalRow}><Text style={s.subtotalLabel}>Total cost · کل اخراجات</Text><Text style={s.subtotalAmount}>{fmtPkr(data.totalCostPkr)}</Text></View>

        <View style={s.totalRow}>
          <Text style={s.totalLabel}>
            {data.grossMarginPkr >= 0 ? 'Gross Margin · مجموعی منافع' : 'Gross Loss · مجموعی نقصان'}
          </Text>
          <Text style={s.totalAmount}>{fmtPkr(data.grossMarginPkr)}</Text>
        </View>
        <View style={s.totalRow}>
          <Text style={s.totalLabel}>Margin per acre · فی ایکڑ منافع</Text>
          <Text style={s.totalAmount}>{fmtPkr(data.marginPerAcrePkr)}</Text>
        </View>

        <View style={s.footer} fixed>
          <Text>agri.feerasta.ai · Field P&L</Text>
          <Text>Crop plan {data.cropPlanId}</Text>
        </View>
      </Page>
    </Document>
  );
}
