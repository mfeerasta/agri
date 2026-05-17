import { Card, CardContent, ChartCard, StatBlock, Pkr } from '@zameen/ui';
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
