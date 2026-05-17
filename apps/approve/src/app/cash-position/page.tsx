import { Card, CardHeader, CardTitle, CardContent, StatBlock, Pkr } from '@zameen/ui';

export default function CashPositionPage() {
  return (
    <main className="mx-auto max-w-3xl p-4 space-y-4">
      <h1 className="font-display text-2xl">Cash position</h1>
      <div className="grid grid-cols-2 md:grid-cols-3 divide-x divide-[var(--rule)]">
        <StatBlock label="Cash on hand" value={<Pkr value={0} mode="lac_crore" />} />
        <StatBlock label="Bank balance" value={<Pkr value={0} mode="lac_crore" />} caption="Soneri current" />
        <StatBlock label="Net position" value={<Pkr value={0} mode="lac_crore" />} />
      </div>
      <Card>
        <CardHeader><CardTitle>30-day inflow vs outflow</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-[var(--ink)]/70">Pulls from computeCashFlowForecast(entityId, 30). UI lights up once the forecast runs.</p>
        </CardContent>
      </Card>
    </main>
  );
}
