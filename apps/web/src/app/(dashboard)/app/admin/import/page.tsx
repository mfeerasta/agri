import Link from 'next/link';
import { Masthead, SectionDivider, Card, CardContent } from '@zameen/ui';
import { IMPORT_TARGETS } from '@/modules/admin/import-targets';

export const dynamic = 'force-dynamic';

export default function ImportHubPage() {
  const targets = Object.values(IMPORT_TARGETS);
  return (
    <div>
      <Masthead section="BULK IMPORT" />
      <SectionDivider />
      <div className="text-xs text-[var(--fg-muted)] mb-3">
        Pick a target. Each importer is a 3-step flow: upload CSV, map columns, preview and commit.
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {targets.map((t) => (
          <Link key={t.key} href={`/admin/import/${t.key}` as never}>
            <Card>
              <CardContent className="p-4 hover:bg-[var(--paper-2)]">
                <div className="smallcaps text-xs">{t.label}</div>
                <div className="text-sm text-[var(--fg-muted)] mt-1">{t.description}</div>
                <div className="text-[0.7rem] text-[var(--fg-muted)] mt-2 tabular">
                  {t.fields.length} fields · {t.fields.filter((f) => f.required).length} required
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
