import Link from 'next/link';
import { Masthead, SectionDivider, DashboardGrid, EmptyState } from '@zameen/ui';
import type { WidgetConfig } from '@zameen/ui';
import { getDefaultDashboard } from '@/modules/dashboards/actions';
import { WidgetRenderer } from '@/modules/dashboards/widget-renderer';
import { LiveActivityWidget } from '@/modules/dashboard/components/live-activity-widget';

export const dynamic = 'force-dynamic';

export default async function DashboardsHome() {
  const dash = await getDefaultDashboard();

  if (!dash) {
    return (
      <div>
        <Masthead section="MY DASHBOARD" />
        <SectionDivider />
        <EmptyState
          title="No dashboard yet"
          description="Build one with the widget editor and pin it as your default."
          action={
            <Link
              href="/dashboards/edit"
              className="px-4 py-2 rounded-md bg-[var(--accent)] text-[var(--accent-fg)] text-sm font-medium"
            >
              Edit dashboard
            </Link>
          }
        />
      </div>
    );
  }

  const widgets = (dash.widgets ?? []) as WidgetConfig[];

  return (
    <div>
      <Masthead section={dash.name.toUpperCase()} />
      <SectionDivider />
      <div className="flex justify-end mb-4">
        <Link
          href="/dashboards/edit"
          className="text-xs px-3 py-1 rounded border border-[var(--accent)] text-[var(--accent)]"
        >
          Edit
        </Link>
      </div>
      <DashboardGrid widgets={widgets} renderWidget={(w) => <WidgetRenderer widget={w} />} />
      <div className="mt-6">
        <LiveActivityWidget max={20} />
      </div>
    </div>
  );
}
