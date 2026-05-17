import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db, cropPlans, fields, cropProfiles } from '@zameen/db';
import { Masthead, Card, CardContent, CardHeader, CardTitle } from '@zameen/ui';
import { InspectForm } from './inspect-form';

export const dynamic = 'force-dynamic';

export default async function InspectDetail({ params }: { params: Promise<{ cropPlanId: string }> }) {
  const { cropPlanId } = await params;
  const [row] = await db
    .select({
      id: cropPlans.id,
      stage: cropPlans.currentStage,
      varietyName: cropPlans.varietyName,
      acres: cropPlans.plannedAcres,
      fieldCode: fields.code,
      cropName: cropProfiles.name,
    })
    .from(cropPlans)
    .leftJoin(fields, eq(fields.id, cropPlans.fieldId))
    .leftJoin(cropProfiles, eq(cropProfiles.id, cropPlans.cropProfileId))
    .where(eq(cropPlans.id, cropPlanId))
    .limit(1);
  if (!row) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Masthead section="Crop Inspection" />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {row.fieldCode} · {row.cropName}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <div className="flex justify-between"><span>Current stage</span><span className="smallcaps">{row.stage}</span></div>
          <div className="flex justify-between"><span>Variety</span><span>{row.varietyName ?? '—'}</span></div>
          <div className="flex justify-between"><span>Acres</span><span>{Number(row.acres).toFixed(2)}</span></div>
        </CardContent>
      </Card>
      <InspectForm cropPlanId={row.id} currentStage={row.stage} />
    </div>
  );
}
