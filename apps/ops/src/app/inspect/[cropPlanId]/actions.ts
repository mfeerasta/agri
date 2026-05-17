'use server';
import { revalidatePath } from 'next/cache';
import { db, cropStageLogs, cropPlans } from '@zameen/db';
import { eq } from 'drizzle-orm';
import { fireTrigger } from '@zameen/automations';
import { getSessionContext } from '@/lib/session';

interface Payload {
  cropPlanId: string;
  stage: string;
  notes?: string;
  photoUrls: string[];
  pestPressure: 'low' | 'med' | 'high';
  urgentAction: boolean;
}

type Result = { ok: true; id: string } | { ok: false; error: string };

export async function submitInspection(p: Payload): Promise<Result> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };

  const noteSuffix = `[pest=${p.pestPressure}${p.urgentAction ? ',urgent' : ''}]`;
  const [row] = await db
    .insert(cropStageLogs)
    .values({
      cropPlanId: p.cropPlanId,
      stage: p.stage as never,
      observedOn: new Date(),
      observedBy: ctx.userId,
      notes: `${p.notes ?? ''} ${noteSuffix}`.trim(),
      photoUrls: p.photoUrls,
    })
    .returning();

  await db
    .update(cropPlans)
    .set({ currentStage: p.stage as never, updatedAt: new Date() })
    .where(eq(cropPlans.id, p.cropPlanId));

  const [plan] = await db.select().from(cropPlans).where(eq(cropPlans.id, p.cropPlanId)).limit(1);
  await fireTrigger({
    kind: 'crop_stage_advance',
    entityId: plan?.entityId ?? null,
    event: {
      kind: 'crop_stage_advance',
      entityId: plan?.entityId ?? null,
      occurredAt: new Date(),
      payload: {
        cropPlanId: p.cropPlanId,
        stage: p.stage,
        pestPressure: p.pestPressure,
        urgentAction: p.urgentAction,
      },
    },
  });

  revalidatePath(`/inspect/${p.cropPlanId}`);
  return { ok: true, id: row!.id };
}
