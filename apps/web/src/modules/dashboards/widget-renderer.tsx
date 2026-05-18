import { Card, CardContent, ChartCard, StatBlock, Pkr, DeltaPill } from '@zameen/ui';
import type { WidgetConfig } from '@zameen/ui';

// Server-side widget renderer. Each kind has its own simple data path.
// For now, demo data fills the chart/stat widgets; real loaders can be wired
// per-kind in a follow-up without changing the surface.

export function WidgetRenderer({ widget }: { widget: WidgetConfig }) {
  switch (widget.kind) {
    case 'stat':
      return (
        <StatBlock
          label={widget.title}
          value={String(widget.config.value ?? '—')}
          caption={typeof widget.config.caption === 'string' ? widget.config.caption : undefined}
        />
      );
    case 'cash_position':
      return (
        <StatBlock
          label={widget.title}
          value={<Pkr value={Number(widget.config.amountPkr ?? 0)} />}
          caption="Operating cash"
        />
      );
    case 'task_count':
      return (
        <StatBlock
          label={widget.title}
          value={String(widget.config.count ?? 0)}
          caption={typeof widget.config.filter === 'string' ? widget.config.filter : undefined}
        />
      );
    case 'line_chart':
    case 'bar_chart':
    case 'pie_chart':
      return (
        <ChartCard
          title={widget.title}
          data={(widget.config.data as Array<Record<string, number | string>>) ?? []}
          xKey={String(widget.config.xKey ?? 'x')}
          yKey={String(widget.config.yKey ?? 'y')}
          unit={typeof widget.config.unit === 'string' ? widget.config.unit : undefined}
        />
      );
    case 'yoy_kpi': {
      const deltaPct = typeof widget.config.deltaPct === 'number' ? widget.config.deltaPct : null;
      const desirable = widget.config.desirable === 'low' ? 'low' : 'high';
      const isMoney = widget.config.format !== 'number';
      const v = Number(widget.config.value ?? 0);
      return (
        <StatBlock
          label={widget.title}
          value={isMoney ? <Pkr value={v} /> : String(v)}
          caption={typeof widget.config.caption === 'string' ? widget.config.caption : undefined}
          delta={<DeltaPill value={deltaPct} desirable={desirable} />}
        />
      );
    }
    case 'field_trend_sparkline': {
      const series = (widget.config.series as Array<{ season: string; value: number }>) ?? [];
      return (
        <ChartCard
          title={widget.title}
          data={series.map((s) => ({ season: s.season, value: s.value }))}
          xKey="season"
          yKey="value"
          unit={typeof widget.config.unit === 'string' ? widget.config.unit : undefined}
          height={120}
        />
      );
    }
    case 'cost_pool_trend': {
      const series = (widget.config.series as Array<{ season: string; value: number }>) ?? [];
      return (
        <ChartCard
          title={widget.title}
          data={series.map((s) => ({ season: s.season, value: s.value }))}
          xKey="season"
          yKey="value"
          unit={typeof widget.config.unit === 'string' ? widget.config.unit : 'PKR'}
          height={180}
        />
      );
    }
    case 'weather_alerts_recent': {
      const alerts = (widget.config.alerts as Array<{ triggeredOn: string; ruleName: string; observation: unknown }>) ?? [];
      return (
        <Card>
          <CardContent className="p-4">
            <div className="smallcaps text-[0.65rem]">{widget.title}</div>
            {alerts.length === 0 ? (
              <div className="mt-2 text-sm text-[var(--fg-muted)]">No alerts in last 7 days.</div>
            ) : (
              <ul className="mt-2 grid gap-1 text-sm">
                {alerts.slice(0, 7).map((a, i) => (
                  <li key={i} className="flex items-baseline justify-between gap-2">
                    <span className="font-mono text-xs">{a.triggeredOn}</span>
                    <span className="flex-1">{a.ruleName}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      );
    }
    case 'produce_aging': {
      const buckets = (widget.config.buckets as Array<{ bucket: string; weightKg: number; lotCount: number }>) ?? [];
      return (
        <ChartCard
          title={widget.title}
          data={buckets.map((b) => ({ x: b.bucket, y: b.weightKg }))}
          xKey="x"
          yKey="y"
          unit="kg"
          height={140}
        />
      );
    }
    case 'recent_activity':
    case 'approval_queue_preview':
    case 'field_map_mini':
      return (
        <Card>
          <CardContent className="p-4">
            <div className="smallcaps text-[0.65rem]">{widget.title}</div>
            <div className="text-sm text-[var(--fg-muted)] mt-2">
              {widget.kind.replace(/_/g, ' ')} (configure source)
            </div>
          </CardContent>
        </Card>
      );
  }
}
