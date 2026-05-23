/**
 * Field PWA scouting observation endpoint. Inserts into zameen.scouting_observations
 * and returns whether an action threshold was exceeded so the field worker
 * gets immediate guidance.
 */

import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import {
  db,
  scoutingObservations,
  actionThresholds,
  cropPlans,
  cropProfiles,
  inputs,
} from '@zameen/db';
import { getFieldSession } from '../../../lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Payload {
  fieldId?: string;
  cropPlanId?: string;
  observedAtIso?: string;
  scoutMethod?: string;
  sampleCount?: number;
  pestOrDisease?: string;
  severity?: number;
  prevalencePct?: number;
  growthStage?: string;
  gpsLocation?: { lat: number; lng: number; accuracy?: number };
  photoUrls?: string[];
  voiceNoteUrl?: string;
  notes?: string;
}

export async function POST(req: Request): Promise<Response> {
  const session = await getFieldSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Payload | null;
  if (!body) return NextResponse.json({ error: 'invalid_body' }, { status: 400 });

  if (!body.fieldId || !body.pestOrDisease || !body.severity) {
    return NextResponse.json({ error: 'missing_required' }, { status: 400 });
  }
  if (!body.photoUrls?.length) {
    return NextResponse.json({ error: 'photo_required' }, { status: 400 });
  }
  if (body.severity < 1 || body.severity > 5) {
    return NextResponse.json({ error: 'severity_range' }, { status: 400 });
  }

  let cropCode: string | null = null;
  let entityId: string | null = null;
  if (body.cropPlanId) {
    const rows = await db
      .select({ name: cropProfiles.name, entityId: cropPlans.entityId })
      .from(cropPlans)
      .innerJoin(cropProfiles, eq(cropProfiles.id, cropPlans.cropProfileId))
      .where(eq(cropPlans.id, body.cropPlanId))
      .limit(1);
    cropCode = rows[0]?.name?.toLowerCase() ?? null;
    entityId = (rows[0]?.entityId as unknown as string) ?? null;
  }

  let thresholdHit: {
    recommendedResponse: string;
    ipmNotes: string | null;
    suggestedInputName: string | null;
  } | null = null;

  if (cropCode) {
    const candidates = await db
      .select()
      .from(actionThresholds)
      .where(
        and(
          eq(actionThresholds.cropCode, cropCode),
          eq(actionThresholds.pestOrDisease, body.pestOrDisease),
        ),
      );
    const t = candidates.find((c) => entityId && c.entityId === entityId)
      ?? candidates.find((c) => c.entityId === null);
    if (t) {
      const sevHit = t.thresholdSeverity != null && body.severity! >= t.thresholdSeverity;
      const prevHit = t.thresholdPrevalencePct != null && body.prevalencePct != null
        && body.prevalencePct >= Number(t.thresholdPrevalencePct);
      if (sevHit || prevHit) {
        let suggestedInputName: string | null = null;
        if (entityId) {
          const candidateInputs = await db
            .select()
            .from(inputs)
            .where(and(eq(inputs.entityId, entityId), eq(inputs.type, 'pesticide')));
          const text = t.recommendedResponse.toLowerCase();
          const matched = candidateInputs.find((i) => {
            const ai = (i.activeIngredient ?? '').toLowerCase();
            const nm = i.name.toLowerCase();
            return (ai && text.includes(ai)) || (nm && text.includes(nm));
          });
          suggestedInputName = matched?.name ?? null;
        }
        thresholdHit = {
          recommendedResponse: t.recommendedResponse,
          ipmNotes: t.ipmNotes,
          suggestedInputName,
        };
      }
    }
  }

  const [row] = await db
    .insert(scoutingObservations)
    .values({
      fieldId: body.fieldId,
      cropPlanId: body.cropPlanId ?? null,
      observedAt: body.observedAtIso ? new Date(body.observedAtIso) : new Date(),
      observerId: session.userId,
      scoutMethod: (body.scoutMethod as 'w_pattern' | 'x_pattern' | 'random' | 'perimeter' | 'full_field' | undefined) ?? null,
      sampleCount: body.sampleCount ?? null,
      pestOrDisease: body.pestOrDisease,
      severity: body.severity,
      prevalencePct: body.prevalencePct != null ? String(body.prevalencePct) : null,
      growthStage: body.growthStage ?? null,
      gpsLocation: body.gpsLocation ?? null,
      photoUrls: body.photoUrls,
      voiceNoteUrl: body.voiceNoteUrl ?? null,
      recommendedAction: thresholdHit?.recommendedResponse ?? null,
      notes: body.notes ?? null,
    })
    .returning();

  return NextResponse.json({ ok: true, id: row!.id, thresholdHit });
}
