import { Masthead, SectionDivider } from '@zameen/ui';
import { getSessionContext } from '@/lib/session';
import { loadPayrollMatrix } from '@/modules/labor/payroll-matrix-actions';
import { PayrollMatrix } from '@/modules/labor/components/payroll-matrix';

export const dynamic = 'force-dynamic';

export default async function PayrollMatrixPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const ctx = await getSessionContext();
  if (!ctx) return <div className="p-6">Unauthorized</div>;
  const sp = await searchParams;
  const year = Number(sp.year ?? new Date().getUTCFullYear());
  const data = await loadPayrollMatrix({ entityId: ctx.entityId, year });

  return (
    <div>
      <Masthead section="PAYROLL MATRIX" />
      <SectionDivider />
      <PayrollMatrix entityId={ctx.entityId} data={data} />
    </div>
  );
}
