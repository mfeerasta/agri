import { Masthead, SectionDivider } from '@zameen/ui';
import { RepairQuoteForm } from '@/modules/repairs/components/repair-quote-form';

export const dynamic = 'force-dynamic';

export default async function NewRepairQuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div>
      <Masthead section="NEW QUOTE" />
      <SectionDivider />
      <RepairQuoteForm repairRequestId={id} />
    </div>
  );
}
