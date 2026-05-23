import { notFound } from 'next/navigation';
import { db, leaseContracts } from '@zameen/db';
import { eq } from 'drizzle-orm';
import { Masthead, SectionDivider } from '@zameen/ui';
import { LeasePaymentForm } from '@/modules/land/components/lease-payment-form';

export const dynamic = 'force-dynamic';

export default async function NewLeasePaymentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.JSX.Element> {
  const { id } = await params;
  const [lease] = await db.select().from(leaseContracts).where(eq(leaseContracts.id, id)).limit(1);
  if (!lease) notFound();

  return (
    <div className="space-y-2">
      <Masthead section={`Record payment · ${lease.counterpartyName}`} />
      <SectionDivider />
      <LeasePaymentForm leaseId={id} />
    </div>
  );
}
