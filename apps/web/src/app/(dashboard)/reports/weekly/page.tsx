import { Masthead, SectionDivider, EmptyState } from '@zameen/ui';
export default function WeeklyReport() {
  return (
    <div>
      <Masthead section="WEEKLY MANAGEMENT" />
      <SectionDivider />
      <EmptyState title="Weekly KPI report" body="Aggregates last 7 days of tasks, attendance, diesel, repairs, finance. Hooks into existing analytics endpoints." />
    </div>
  );
}
