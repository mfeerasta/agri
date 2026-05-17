import { Masthead, SectionDivider } from '@zameen/ui';
import { db, cropPlans } from '@zameen/db';
import { eq } from 'drizzle-orm';
import { StageLogForm } from '@/modules/crops/components/stage-log-form';

export default async function StageLogPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [plan] = await db
    .select({ fieldId: cropPlans.fieldId })
    .from(cropPlans)
    .where(eq(cropPlans.id, id))
    .limit(1);
  return (
    <div className="space-y-2">
      <Masthead section="STAGE / LOG" />
      <SectionDivider />
      <StageLogForm cropPlanId={id} fieldId={plan?.fieldId} />
    </div>
  );
}
