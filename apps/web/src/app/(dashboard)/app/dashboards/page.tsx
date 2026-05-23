import Link from 'next/link';
import { Masthead, SectionDivider, DashboardGrid, EmptyState, Card, CardHeader, CardTitle, CardContent } from '@zameen/ui';
import type { WidgetConfig } from '@zameen/ui';
import { getDefaultDashboard } from '@/modules/dashboards/actions';
import { WidgetRenderer } from '@/modules/dashboards/widget-renderer';
import { LiveActivityWidget } from '@/modules/dashboard/components/live-activity-widget';
import { listCustomDashboards } from '@/modules/custom-dashboards/actions';

export const dynamic = 'force-dynamic';

export default async function DashboardsHome() {
  const [dash, customs] = await Promise.all([getDefaultDashboard(), listCustomDashboards()]);

  return (
    <div>
      <Masthead section="DASHBOARDS" />
      <SectionDivider />
      <div className="flex justify-end mb-3 gap-2">
        <Link
          href="/dashboards/new"
          className="text-xs px-3 py-1 rounded bg-[var(--accent)] text-[var(--accent-fg)]"
        >
          + Custom dashboard
        </Link>
        <Link
          href="/dashboards/edit"
          className="text-xs px-3 py-1 rounded border border-[var(--accent)] text-[var(--accent)]"
        >
          Edit default
        </Link>
      </div>

      {dash ? (
        <>
          <div className="text-xs smallcaps mb-2">{dash.name}</div>
          <DashboardGrid
            widgets={(dash.widgets ?? []) as WidgetConfig[]}
            renderWidget={(w) => <WidgetRenderer widget={w} />}
          />
        </>
      ) : (
        <EmptyState title="No default dashboard yet" description="Edit a default or build a custom one." />
      )}

      {customs.length > 0 ? (
        <div className="mt-6">
          <SectionDivider />
          <div className="text-xs smallcaps mb-2">Custom dashboards</div>
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {customs.map((c) => (
              <Link key={c.id} href={`/dashboards/${c.id}` as never}>
                <Card className="hover:bg-[var(--paper-2)]">
                  <CardHeader><CardTitle>{c.name}</CardTitle></CardHeader>
                  <CardContent className="smallcaps text-[0.7rem] text-[var(--ink)]/60">
                    {(c.layout as unknown as { length: number }).length} widgets
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-6">
        <LiveActivityWidget max={20} />
      </div>
    </div>
  );
}
