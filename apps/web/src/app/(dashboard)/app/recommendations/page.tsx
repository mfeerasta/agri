import { db, assistantRecommendations } from '@zameen/db';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { getSessionContext } from '@/lib/session';
import { actOnRecommendation } from '@/modules/assistant/actions';

const priorityRank: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

export default async function RecommendationsPage() {
  const session = await getSessionContext();
  const rows = await db
    .select()
    .from(assistantRecommendations)
    .where(
      and(
        eq(assistantRecommendations.entityId, session.entityId),
        isNull(assistantRecommendations.actedOnAt),
        isNull(assistantRecommendations.dismissedAt),
      ),
    )
    .orderBy(desc(assistantRecommendations.generatedAt));

  const sorted = [...rows].sort(
    (a, b) => (priorityRank[a.priority] ?? 9) - (priorityRank[b.priority] ?? 9),
  );

  return (
    <main className="mx-auto max-w-4xl space-y-4 p-6">
      <h1 className="text-2xl font-semibold">Recommendations</h1>
      <p className="text-sm text-gray-600">
        AI-generated suggestions across irrigation, inputs, finance, weather, and compliance.
      </p>
      {sorted.length === 0 && (
        <div className="rounded border border-dashed border-gray-300 p-8 text-center text-gray-500">
          No active recommendations.
        </div>
      )}
      <ul className="space-y-3">
        {sorted.map((r) => (
          <li key={r.id} className="rounded border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className={
                      'inline-block rounded px-2 py-0.5 text-xs font-medium ' +
                      (r.priority === 'urgent'
                        ? 'bg-red-100 text-red-800'
                        : r.priority === 'high'
                          ? 'bg-orange-100 text-orange-800'
                          : r.priority === 'medium'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-gray-100 text-gray-700')
                    }
                  >
                    {r.priority}
                  </span>
                  <span className="text-xs uppercase text-gray-500">{r.category}</span>
                </div>
                <h3 className="mt-1 font-semibold">{r.title}</h3>
                {r.titleUr && <p className="text-sm text-gray-700" dir="rtl">{r.titleUr}</p>}
                <p className="mt-1 text-sm text-gray-700">{r.rationale}</p>
                <p className="mt-2 text-sm font-medium">Action: {r.recommendedAction}</p>
              </div>
              <div className="flex shrink-0 flex-col gap-1">
                <form action={async () => { 'use server'; await actOnRecommendation({ id: r.id, action: 'act' }); }}>
                  <button className="rounded bg-emerald-600 px-3 py-1 text-xs text-white">
                    Act on
                  </button>
                </form>
                <form action={async () => { 'use server'; await actOnRecommendation({ id: r.id, action: 'ack' }); }}>
                  <button className="rounded border border-gray-300 px-3 py-1 text-xs">
                    Acknowledge
                  </button>
                </form>
                <form action={async () => { 'use server'; await actOnRecommendation({ id: r.id, action: 'dismiss' }); }}>
                  <button className="rounded border border-gray-300 px-3 py-1 text-xs text-gray-600">
                    Dismiss
                  </button>
                </form>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
