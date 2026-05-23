'use client';
import { InputUsageGrid } from './input-usage-grid';
import type { InputUsageLogData } from '../input-usage-log-actions';

export interface FertilizerGridProps {
  entityId: string;
  data: InputUsageLogData;
  cropPlans: Array<{ id: string; fieldId: string; cropName: string }>;
}

export function FertilizerGrid({ entityId, data, cropPlans }: FertilizerGridProps) {
  return (
    <InputUsageGrid
      entityId={entityId}
      data={data}
      cropPlans={cropPlans}
      title="Fertilizer Log"
      titleUr="کھاد لاگ"
      recordLabel="Record fertilizer"
      recordLabelUr="کھاد درج کریں"
      itemLabel="fertilizer"
      itemLabelUr="کھاد"
      xlsxRoutePrefix="/api/inventory/fertilizer-log/xlsx"
      revalidatePath="/inventory/fertilizer-log"
    />
  );
}
