/**
 * Voucher numbering wrapper. The atomic counter lives in
 * `zameen.voucher_counters` (migration 0044) and the SQL function
 * `zameen.next_voucher_number(entity, kind)` returns the next prefixed
 * number for the current fiscal year, e.g. `CRV-26-27-00001`.
 *
 * Use `nextVoucherNumber()` for any kind not covered by the journal-entry
 * trigger (which already assigns CRV/CPV/BRV/BPV/JV automatically).
 */

import { sql } from 'drizzle-orm';
import { db } from '@zameen/db';

export type VoucherKind =
  | 'cash-receipt'
  | 'cash-payment'
  | 'bank-receipt'
  | 'bank-payment'
  | 'journal'
  | 'payslip'
  | 'mandi-patti'
  | 'grn'
  | 'purchase-invoice'
  | 'diesel-purchase';

export async function nextVoucherNumber(entityId: string, kind: VoucherKind): Promise<string> {
  const rows = await db.execute<{ next_voucher_number: string }>(
    sql`select zameen.next_voucher_number(${entityId}::uuid, ${kind}) as next_voucher_number`,
  );
  const list = rows as unknown as { next_voucher_number: string }[];
  const first = Array.isArray(list) ? list[0] : (rows as { rows?: { next_voucher_number: string }[] }).rows?.[0];
  if (!first?.next_voucher_number) {
    throw new Error(`Failed to allocate voucher number for kind=${kind}`);
  }
  return first.next_voucher_number;
}
