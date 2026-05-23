import { Masthead, SectionDivider } from '@zameen/ui';
import { listThresholds } from '@/modules/compliance/scouting-actions';
import { ThresholdsClient } from '@/modules/compliance/thresholds-client';

export const dynamic = 'force-dynamic';

export default async function ThresholdsPage() {
  const rows = await listThresholds();
  const normalized = rows.map((r) => ({
    id: r.id,
    entityId: r.entityId,
    cropCode: r.cropCode,
    pestOrDisease: r.pestOrDisease,
    thresholdSeverity: r.thresholdSeverity,
    thresholdPrevalencePct: r.thresholdPrevalencePct,
    recommendedResponse: r.recommendedResponse,
    ipmNotes: r.ipmNotes,
    source: r.source,
  }));
  return (
    <div>
      <Masthead section="ACTION THRESHOLDS (IPM)" />
      <SectionDivider />
      <p className="mb-4 text-sm text-[var(--ink)]/70">
        Pre-populated from Punjab Agri Dept extension service. Customize per entity to reflect local pressure and resistant varieties.
      </p>
      <ThresholdsClient rows={normalized} />
    </div>
  );
}
