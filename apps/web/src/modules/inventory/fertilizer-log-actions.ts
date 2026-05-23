'use server';
import { revalidatePath } from 'next/cache';
import {
  loadInputUsageLog,
  getLatestUnitCost,
  quickIssueInput,
  type InputUsageLogData,
  type InputUsageRow,
  type InputUsageCell,
  type QuickIssueArgs,
} from './input-usage-log-actions';

export type FertilizerLogCell = InputUsageCell;
export type FertilizerLogRow = InputUsageRow;
export type FertilizerLogData = InputUsageLogData;

export async function loadFertilizerLog({
  entityId,
  fromDate,
  toDate,
}: {
  entityId: string;
  fromDate: string;
  toDate: string;
}): Promise<FertilizerLogData> {
  return loadInputUsageLog({ entityId, fromDate, toDate, inputType: 'fertilizer' });
}

export { getLatestUnitCost };

export async function quickIssueFertilizer(args: QuickIssueArgs): Promise<{ ok: boolean; error?: string }> {
  const res = await quickIssueInput({ ...args, revalidate: '/inventory/fertilizer-log' });
  if (res.ok) revalidatePath('/inventory/fertilizer-log');
  return res;
}
