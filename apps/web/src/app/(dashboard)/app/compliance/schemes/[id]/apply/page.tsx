import { notFound } from 'next/navigation';
import { db, governmentSchemes, entities } from '@zameen/db';
import { eq } from 'drizzle-orm';
import { Masthead, SectionDivider, Card, CardHeader, CardTitle, CardContent } from '@zameen/ui';
import { ApplyForm } from './apply-form';

export const dynamic = 'force-dynamic';

export default async function ApplySchemePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [scheme] = await db.select().from(governmentSchemes).where(eq(governmentSchemes.id, id));
  if (!scheme) return notFound();
  const ents = await db.select({ id: entities.id, name: entities.name }).from(entities).limit(50);

  return (
    <div>
      <Masthead section={`APPLY: ${scheme.name.toUpperCase()}`} />
      <SectionDivider />

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Scheme</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <div className="font-medium">{scheme.name}</div>
            {scheme.nameUr ? (
              <div className="text-xs text-[var(--ink)]/60" dir="rtl">{scheme.nameUr}</div>
            ) : null}
            <div className="smallcaps text-[0.7rem] text-[var(--ink)]/60">
              {scheme.authority} · {scheme.schemeType ?? '—'} · {scheme.region ?? 'Pakistan'}
            </div>
            {scheme.description ? <div className="text-xs">{scheme.description}</div> : null}
            {scheme.benefitSummary ? (
              <div className="text-xs">
                <span className="smallcaps text-[0.65rem] text-[var(--ink)]/60">Benefit:</span>{' '}
                {scheme.benefitSummary}
              </div>
            ) : null}
            {scheme.eligibilityCriteria ? (
              <div className="text-xs">
                <div className="smallcaps text-[0.65rem] text-[var(--ink)]/60">Eligibility</div>
                <pre className="whitespace-pre-wrap text-[0.7rem]">
                  {JSON.stringify(scheme.eligibilityCriteria, null, 2)}
                </pre>
              </div>
            ) : null}
            {scheme.applicationUrl ? (
              <a
                href={scheme.applicationUrl}
                target="_blank"
                rel="noreferrer"
                className="underline text-xs"
              >
                Official application portal
              </a>
            ) : null}
          </CardContent>
        </Card>

        <div className="lg:col-span-2">
          <ApplyForm schemeId={scheme.id} entities={ents} />
        </div>
      </div>
    </div>
  );
}
