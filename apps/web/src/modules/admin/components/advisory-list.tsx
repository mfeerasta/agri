import type { ExternalAdvisory } from '@zameen/db';

export function AdvisoryList({ advisories }: { advisories: ExternalAdvisory[] }) {
  if (advisories.length === 0) {
    return <p className="text-sm text-stone-500">No advisories ingested yet.</p>;
  }
  return (
    <ul className="space-y-3">
      {advisories.map((a) => (
        <li key={a.id} className="rounded border border-stone-200 bg-white p-3">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="font-semibold">{a.title}</h3>
            <span className="text-xs text-stone-500">
              {a.source} | {a.publishedOn}
            </span>
          </div>
          {a.aiSummary && <p className="mt-1 text-sm">{a.aiSummary}</p>}
          {Array.isArray(a.commodities) && a.commodities.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {a.commodities.map((c) => (
                <span key={c} className="rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">
                  {c}
                </span>
              ))}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
