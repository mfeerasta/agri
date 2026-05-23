import { Masthead, SectionDivider } from '@zameen/ui';
import { listCustomReports } from '@/modules/custom-reports/actions';
import { DashboardComposer } from '@/modules/custom-dashboards/dashboard-composer';

export const dynamic = 'force-dynamic';

export default async function NewDashboardPage() {
  const reports = await listCustomReports();
  return (
    <div>
      <Masthead section="NEW DASHBOARD" />
      <SectionDivider />
      <DashboardComposer reports={reports.map((r) => ({ id: r.id, name: r.name }))} />
    </div>
  );
}
