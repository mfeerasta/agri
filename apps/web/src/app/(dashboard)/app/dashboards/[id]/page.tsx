import { notFound } from 'next/navigation';
import { Masthead, SectionDivider } from '@zameen/ui';
import { getCustomDashboard } from '@/modules/custom-dashboards/actions';
import { DashboardViewer } from '@/modules/custom-dashboards/dashboard-viewer';
import type { DashboardWidgetLayout } from '@zameen/db';

export const dynamic = 'force-dynamic';

export default async function CustomDashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const dash = await getCustomDashboard(id);
  if (!dash) notFound();
  const layout = (dash.layout ?? []) as DashboardWidgetLayout[];
  return (
    <div>
      <Masthead section={dash.name.toUpperCase()} />
      <SectionDivider />
      <DashboardViewer layout={layout} />
    </div>
  );
}
