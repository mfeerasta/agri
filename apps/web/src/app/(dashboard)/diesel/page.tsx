import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@zameen/ui';
import { db, dieselAnomalies } from '@zameen/db';
import { eq, count } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export default async function DieselHome() {
  const [openRow] = await db
    .select({ n: count() })
    .from(dieselAnomalies)
    .where(eq(dieselAnomalies.status, 'open'));
  const [critRow] = await db
    .select({ n: count() })
    .from(dieselAnomalies)
    .where(eq(dieselAnomalies.severity, 'critical'));
  const openCount = Number(openRow?.n ?? 0);
  const critCount = Number(critRow?.n ?? 0);

  return (
    <div className="space-y-6">
      {openCount > 0 ? (
        <Link
          href={'/diesel/anomalies' as never}
          className="block rounded-md border px-4 py-3 text-sm"
          style={{
            borderColor: critCount > 0 ? 'var(--danger)' : 'var(--warning)',
            background: critCount > 0 ? 'rgba(220,38,38,0.08)' : 'rgba(245,158,11,0.08)',
            color: critCount > 0 ? 'var(--danger)' : 'var(--warning)',
          }}
        >
          {openCount} open diesel anomal{openCount === 1 ? 'y' : 'ies'}
          {critCount > 0 ? ` (${critCount} critical)` : ''}. Review and acknowledge.
        </Link>
      ) : null}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Diesel & Fuel</h1>
        <div className="flex gap-2">
          <Link href={'/diesel/purchases/new' as never} className="rounded-md bg-emerald-700 px-4 py-2 text-white">New purchase</Link>
          <Link href={'/diesel/logs/new' as never} className="rounded-md bg-emerald-600 px-4 py-2 text-white">Daily log</Link>
          <Link href={'/diesel/reconcile' as never} className="rounded-md bg-slate-700 px-4 py-2 text-white">Reconcile</Link>
          <Link href={'/diesel/anomalies' as never} className="rounded-md bg-slate-600 px-4 py-2 text-white">Anomalies</Link>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">Stock today</CardTitle></CardHeader>
          <CardContent className="text-3xl font-semibold">0 L</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Cost per acre (30d)</CardTitle></CardHeader>
          <CardContent className="text-3xl font-semibold">—</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">L/hr — rolling 30d</CardTitle></CardHeader>
          <CardContent className="text-3xl font-semibold">—</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Open anomalies</CardTitle></CardHeader>
          <CardContent
            className="text-3xl font-semibold"
            style={{ color: critCount > 0 ? 'var(--danger)' : openCount > 0 ? 'var(--warning)' : undefined }}
          >
            {openCount}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
