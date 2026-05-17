import { Masthead, SectionDivider, Card, CardHeader, CardTitle, CardContent, EmptyState } from '@zameen/ui';

export const dynamic = 'force-dynamic';

export default function CashFlowPage() {
  return (
    <div>
      <Masthead section="CASH FLOW" />
      <SectionDivider />
      <Card>
        <CardHeader><CardTitle>90-day forecast</CardTitle></CardHeader>
        <CardContent>
          <EmptyState
            title="Forecast not yet computed"
            body="Click refresh to call computeCashFlowForecast(entityId, 90). Persisted to cash_flow_forecasts."
          />
        </CardContent>
      </Card>
    </div>
  );
}
