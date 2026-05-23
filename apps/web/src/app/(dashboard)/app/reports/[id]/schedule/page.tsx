import { Masthead, SectionDivider } from '@zameen/ui';
import { ScheduleForm } from '@/modules/custom-reports/schedule-form';

export const dynamic = 'force-dynamic';

export default async function ScheduleReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div>
      <Masthead section="SCHEDULE REPORT" />
      <SectionDivider />
      <ScheduleForm reportId={id} />
    </div>
  );
}
