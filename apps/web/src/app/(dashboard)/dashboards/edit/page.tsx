import { Masthead, SectionDivider } from '@zameen/ui';
import type { WidgetConfig } from '@zameen/ui';
import { getDefaultDashboard } from '@/modules/dashboards/actions';
import { DashboardEditor } from '@/modules/dashboards/dashboard-editor';

export const dynamic = 'force-dynamic';

export default async function DashboardEditPage() {
  const dash = await getDefaultDashboard();
  return (
    <div>
      <Masthead section="EDIT DASHBOARD" />
      <SectionDivider />
      <DashboardEditor
        id={dash?.id}
        initialName={dash?.name ?? 'My dashboard'}
        initialWidgets={(dash?.widgets ?? []) as WidgetConfig[]}
      />
    </div>
  );
}
