import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db, leaseContracts, leasePayments, sharecropSettlements, fields, blocks, farms } from '@zameen/db';
import { eq, desc } from 'drizzle-orm';
import { Card, CardContent, CardHeader, CardTitle, Masthead, SectionDivider } from '@zameen/ui';
import { LeasePaymentTracker } from '@/modules/land/components/lease-payment-tracker';

export const dynamic = 'force-dynamic';

export default async function LeaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.JSX.Element> {
  const { id } = await params;
  const [lease] = await db
    .select({
      id: leaseContracts.id,
      fieldId: leaseContracts.fieldId,
      fieldCode: fields.code,
      fieldName: fields.name,
      blockCode: blocks.code,
      farmName: farms.name,
      counterpartyName: leaseContracts.counterpartyName,
      counterpartyCnic: leaseContracts.counterpartyCnic,
      counterpartyPhone: leaseContracts.counterpartyPhone,
      tenure: leaseContracts.tenure,
      startDate: leaseContracts.startDate,
      endDate: leaseContracts.endDate,
      annualRentPkr: leaseContracts.annualRentPkr,
      rentPaymentSchedule: leaseContracts.rentPaymentSchedule,
      sharePctLandowner: leaseContracts.sharePctLandowner,
      sharePctTenant: leaseContracts.sharePctTenant,
      inputShareArrangement: leaseContracts.inputShareArrangement,
      deedDocUrl: leaseContracts.deedDocUrl,
      status: leaseContracts.status,
      notes: leaseContracts.notes,
    })
    .from(leaseContracts)
    .leftJoin(fields, eq(fields.id, leaseContracts.fieldId))
    .leftJoin(blocks, eq(blocks.id, fields.blockId))
    .leftJoin(farms, eq(farms.id, blocks.farmId))
    .where(eq(leaseContracts.id, id))
    .limit(1);

  if (!lease) notFound();

  const payments = await db
    .select()
    .from(leasePayments)
    .where(eq(leasePayments.leaseId, id))
    .orderBy(desc(leasePayments.paidOn));

  const settlements = await db
    .select()
    .from(sharecropSettlements)
    .where(eq(sharecropSettlements.leaseId, id))
    .orderBy(desc(sharecropSettlements.settledOn));

  const isRented = lease.tenure === 'rented_in' || lease.tenure === 'rented_out';
  const isShare = lease.tenure === 'sharecrop_in' || lease.tenure === 'sharecrop_out' || lease.tenure === 'musharka';

  return (
    <div className="space-y-2">
      <Masthead section={`Lease · ${lease.counterpartyName}`} />
      <SectionDivider />

      <div className="grid gap-3 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Contract · معاہدہ</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1.5">
            <div><span className="text-slate-500">Field:</span> {lease.fieldCode} — {lease.farmName}/{lease.blockCode}</div>
            <div><span className="text-slate-500">Counterparty:</span> {lease.counterpartyName}</div>
            {lease.counterpartyCnic ? <div><span className="text-slate-500">CNIC:</span> {lease.counterpartyCnic}</div> : null}
            {lease.counterpartyPhone ? <div><span className="text-slate-500">Phone:</span> {lease.counterpartyPhone}</div> : null}
            <div><span className="text-slate-500">Tenure:</span> {lease.tenure.replace(/_/g, ' ')}</div>
            <div><span className="text-slate-500">Period:</span> {String(lease.startDate)} → {lease.endDate ? String(lease.endDate) : 'open'}</div>
            <div><span className="text-slate-500">Status:</span> {lease.status}</div>
            {lease.notes ? <div className="pt-2 text-slate-700">{lease.notes}</div> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Terms · شرائط</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1.5">
            {isRented ? (
              <>
                <div><span className="text-slate-500">Annual rent:</span> PKR {Number(lease.annualRentPkr ?? 0).toLocaleString('en-PK')}</div>
                <div><span className="text-slate-500">Schedule:</span> {lease.rentPaymentSchedule ?? '—'}</div>
              </>
            ) : null}
            {isShare ? (
              <>
                <div><span className="text-slate-500">Landowner share:</span> {lease.sharePctLandowner}%</div>
                <div><span className="text-slate-500">Tenant share:</span> {lease.sharePctTenant}%</div>
                {lease.inputShareArrangement ? (
                  <pre className="mt-2 text-xs bg-slate-50 p-2 rounded">{JSON.stringify(lease.inputShareArrangement, null, 2)}</pre>
                ) : null}
              </>
            ) : null}
            {lease.deedDocUrl ? (
              <div>
                <a href={lease.deedDocUrl} target="_blank" rel="noreferrer" className="text-blue-700 underline">
                  Open deed document →
                </a>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {isRented ? (
        <>
          <SectionDivider label="Payments · ادائیگیاں" />
          <div className="flex justify-end">
            <Link
              href={`/land/leases/${id}/payment/new` as never}
              className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--bg)] hover:opacity-90 inline-flex items-center"
            >
              Record payment · ادائیگی درج
            </Link>
          </div>
          <LeasePaymentTracker
            startDate={String(lease.startDate)}
            endDate={lease.endDate ? String(lease.endDate) : null}
            annualRentPkr={Number(lease.annualRentPkr ?? 0)}
            schedule={(lease.rentPaymentSchedule as 'annual' | 'semi_annual' | 'quarterly' | 'monthly' | 'seasonal' | null) ?? 'annual'}
            payments={payments.map((p) => ({ paidOn: String(p.paidOn), amountPkr: Number(p.amountPkr) }))}
          />

          <Card>
            <CardContent className="p-0">
              <table className="min-w-full text-sm">
                <thead className="border-b border-[var(--rule)] text-left text-xs uppercase text-slate-500">
                  <tr><th className="p-3">Paid on</th><th className="p-3">Amount</th><th className="p-3">Method</th><th className="p-3">Reference</th><th className="p-3">Approval</th></tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="border-b border-[var(--rule)]">
                      <td className="p-3 md:py-2 tabular">{String(p.paidOn)}</td>
                      <td className="p-3 md:py-2 tabular">PKR {Number(p.amountPkr).toLocaleString('en-PK')}</td>
                      <td className="p-3 md:py-2">{p.paymentMethod}</td>
                      <td className="p-3 md:py-2">{p.referenceNumber ?? '—'}</td>
                      <td className="p-3 md:py-2 text-xs">{p.approvalRequestId ? 'Routed' : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      ) : null}

      {isShare ? (
        <>
          <SectionDivider label="Settlements · حساب کتاب" />
          <Card>
            <CardContent className="p-0">
              <table className="min-w-full text-sm">
                <thead className="border-b border-[var(--rule)] text-left text-xs uppercase text-slate-500">
                  <tr><th className="p-3">Settled</th><th className="p-3">Produce kg</th><th className="p-3">Gross PKR</th><th className="p-3">Deductions</th><th className="p-3">Landowner</th><th className="p-3">Tenant</th></tr>
                </thead>
                <tbody>
                  {settlements.map((s) => (
                    <tr key={s.id} className="border-b border-[var(--rule)]">
                      <td className="p-3 md:py-2 tabular">{String(s.settledOn)}</td>
                      <td className="p-3 md:py-2 tabular">{Number(s.grossProduceKg).toLocaleString('en-PK')}</td>
                      <td className="p-3 md:py-2 tabular">{Number(s.grossRevenuePkr).toLocaleString('en-PK')}</td>
                      <td className="p-3 md:py-2 tabular">{Number(s.deductionsPkr).toLocaleString('en-PK')}</td>
                      <td className="p-3 md:py-2 tabular">{Number(s.landownerSharePkr).toLocaleString('en-PK')}</td>
                      <td className="p-3 md:py-2 tabular">{Number(s.tenantSharePkr).toLocaleString('en-PK')}</td>
                    </tr>
                  ))}
                  {settlements.length === 0 ? (
                    <tr><td colSpan={6} className="p-3 text-center text-slate-500">No settlements yet. They auto-generate at harvest.</td></tr>
                  ) : null}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
