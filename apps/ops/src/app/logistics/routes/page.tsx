import Link from 'next/link';
import { desc, eq } from 'drizzle-orm';
import { db, dispatchRoutes } from '@zameen/db';
import { Card, CardContent, CardHeader, CardTitle, Masthead, Pkr, SectionDivider } from '@zameen/ui';
import { getSessionContext } from '@/lib/session';

export const dynamic = 'force-dynamic';

interface Destination {
  name: string;
  lat: number;
  lng: number;
  mandi?: boolean;
}

export default async function RoutesPage() {
  const ctx = await getSessionContext();
  const entityId = ctx?.entityId ?? '';
  const rows = entityId
    ? await db
        .select()
        .from(dispatchRoutes)
        .where(eq(dispatchRoutes.entityId, entityId))
        .orderBy(desc(dispatchRoutes.createdAt))
    : [];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Masthead section="Dispatch routes" />
      <Link href={'/logistics/routes/new' as never} className="smallcaps inline-block rounded-sm bg-[var(--zameen-700)] px-3 py-2 text-[var(--paper)]">
        New route
      </Link>
      <SectionDivider label={`${rows.length} routes`} />
      <div className="grid gap-3 md:grid-cols-2">
        {rows.map((r) => {
          const dests = (r.destinations as Destination[]) ?? [];
          return (
            <Card key={r.id}>
              <CardHeader>
                <CardTitle className="text-base">{r.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <div className="smallcaps text-[0.65rem] text-[var(--zameen-600)]">
                  {dests.map((d) => d.name).join(' → ')}
                </div>
                <div className="tabular text-xs">
                  {r.estimatedDistanceKm ? `${Number(r.estimatedDistanceKm).toFixed(1)} km` : '—'} ·{' '}
                  {r.estimatedDurationMinutes ? `${r.estimatedDurationMinutes} min` : '—'}
                </div>
                {r.tollCostPkr && (
                  <div className="tabular text-xs">
                    Toll <Pkr value={Number(r.tollCostPkr)} />
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
