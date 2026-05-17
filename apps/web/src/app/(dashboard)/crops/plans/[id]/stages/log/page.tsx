import { Masthead, SectionDivider } from '@zameen/ui';
import { StageLogForm } from '@/modules/crops/components/stage-log-form';

export default async function StageLogPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="space-y-2">
      <Masthead section="STAGE / LOG" />
      <SectionDivider />
      <StageLogForm cropPlanId={id} />
    </div>
  );
}
