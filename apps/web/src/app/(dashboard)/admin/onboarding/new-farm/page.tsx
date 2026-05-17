import { db, entities, cropProfiles, onboardingDrafts } from '@zameen/db';
import { and, asc, desc, eq, isNull } from 'drizzle-orm';
import { Masthead, SectionDivider } from '@zameen/ui';
import { getSessionContext } from '@/lib/session';
import { OnboardingWizard } from '@/modules/onboarding/wizard';
import type { WizardState } from '@/modules/onboarding/types';

export const dynamic = 'force-dynamic';

export default async function NewFarmOnboardingPage() {
  const ctx = await getSessionContext();
  if (!ctx) return <div className="p-6">Not authenticated.</div>;

  const entityRows = await db
    .select({ id: entities.id, name: entities.name })
    .from(entities)
    .orderBy(asc(entities.name));

  const cropRows = await db
    .select({ id: cropProfiles.id, name: cropProfiles.name, nameUr: cropProfiles.nameUr, season: cropProfiles.season })
    .from(cropProfiles)
    .orderBy(asc(cropProfiles.name));

  const [draft] = await db
    .select()
    .from(onboardingDrafts)
    .where(and(eq(onboardingDrafts.createdBy, ctx.userId), isNull(onboardingDrafts.finalizedAt)))
    .orderBy(desc(onboardingDrafts.updatedAt))
    .limit(1);

  return (
    <div>
      <Masthead section="NEW FARM" />
      <SectionDivider />
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold">Onboard a new farm</h1>
        <p className="text-sm text-[var(--ink)]/70">
          Five guided steps. Draft state is autosaved so you can resume later.
          {draft ? ' Resuming your most recent draft.' : ''}
        </p>
      </div>
      <SectionDivider />
      <OnboardingWizard
        entities={entityRows}
        cropProfiles={cropRows.map((c) => ({ ...c, season: c.season ?? undefined }))}
        initialDraftId={draft?.id ?? null}
        initialState={(draft?.state as WizardState | undefined) ?? undefined}
      />
    </div>
  );
}
