import { and, gte, lte } from 'drizzle-orm';
import { db, holidays } from '@zameen/db';

function isoPlusDays(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function UpcomingHolidays() {
  const today = new Date().toISOString().slice(0, 10);
  const horizon = isoPlusDays(30);
  const rows = await db
    .select()
    .from(holidays)
    .where(and(gte(holidays.date, today), lte(holidays.date, horizon)));
  if (rows.length === 0) {
    return (
      <section className="rounded border border-stone-200 bg-white p-4">
        <h3 className="text-sm font-semibold">Upcoming holidays</h3>
        <p className="mt-2 text-xs text-stone-500">No holidays in the next 30 days.</p>
      </section>
    );
  }
  return (
    <section className="rounded border border-stone-200 bg-white p-4">
      <h3 className="text-sm font-semibold">Upcoming holidays (30 days)</h3>
      <ul className="mt-2 space-y-1 text-sm">
        {rows.map((h) => (
          <li key={h.id} className="flex justify-between gap-2">
            <span>
              {h.name}
              {h.nameUr && <span className="ml-2 text-stone-500">| {h.nameUr}</span>}
            </span>
            <span className="text-stone-500">{h.date}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
