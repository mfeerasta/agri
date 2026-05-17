import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@zameen/ui';

export default function RepairsHome() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Repairs & Maintenance</h1>
        <div className="flex gap-2">
          <Link href={'/repairs/board' as never} className="rounded-md border border-[var(--border)] px-4 py-2 text-sm hover:bg-[var(--surface-2)]">
            Board
          </Link>
          <Link href={'/repairs/new' as never} className="rounded-md bg-emerald-700 px-4 py-2 text-white">
            Report issue
          </Link>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardHeader><CardTitle className="text-sm">Open requests</CardTitle></CardHeader><CardContent className="text-3xl font-semibold">0</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Awaiting quotes</CardTitle></CardHeader><CardContent className="text-3xl font-semibold">0</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Pending approval</CardTitle></CardHeader><CardContent className="text-3xl font-semibold">0</CardContent></Card>
      </div>
    </div>
  );
}
