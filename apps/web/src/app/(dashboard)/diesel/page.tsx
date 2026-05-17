import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@zameen/ui';

export default function DieselHome() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Diesel & Fuel</h1>
        <div className="flex gap-2">
          <Link href={'/diesel/purchases/new' as never} className="rounded-md bg-emerald-700 px-4 py-2 text-white">New purchase</Link>
          <Link href={'/diesel/logs/new' as never} className="rounded-md bg-emerald-600 px-4 py-2 text-white">Daily log</Link>
          <Link href={'/diesel/reconcile' as never} className="rounded-md bg-slate-700 px-4 py-2 text-white">Reconcile</Link>
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
          <CardHeader><CardTitle className="text-sm">Anomalies flagged</CardTitle></CardHeader>
          <CardContent className="text-3xl font-semibold text-amber-700">0</CardContent>
        </Card>
      </div>
    </div>
  );
}
