'use server';

import { db, safetyIncidents, entities, workers } from '@zameen/db';
import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

const HIGH_SEVERITIES = new Set(['medical_treatment', 'lost_time', 'fatality']);

export async function createSafetyIncident(formData: FormData) {
  const occurredAtRaw = String(formData.get('occurredAt') ?? '').trim();
  const severity = String(formData.get('severity') ?? '');
  const category = String(formData.get('category') ?? '') || null;
  const description = String(formData.get('description') ?? '').trim();
  const workerIdRaw = String(formData.get('workerId') ?? '').trim();
  const fieldIdRaw = String(formData.get('fieldId') ?? '').trim();
  const lostDays = Number(formData.get('lostDays') ?? 0);
  const medicalAttention = formData.get('medicalAttentionRequired') === 'on';
  const immediateAction = String(formData.get('immediateActionTaken') ?? '') || null;
  const photoUrlsRaw = String(formData.get('photoUrls') ?? '');
  const photoUrls = photoUrlsRaw.split(/\s+/).filter(Boolean);

  if (!occurredAtRaw || !severity || !description) {
    throw new Error('Missing required fields');
  }
  if (photoUrls.length === 0) {
    throw new Error('At least one photo URL required as evidence');
  }

  let entityId: string | null = null;
  if (workerIdRaw) {
    const [w] = await db.select({ entityId: workers.entityId }).from(workers).where(eq(workers.id, workerIdRaw)).limit(1);
    entityId = w?.entityId ?? null;
  }
  if (!entityId) {
    const [e] = await db.select({ id: entities.id }).from(entities).where(eq(entities.code, 'AGRI')).limit(1);
    entityId = e?.id ?? null;
  }
  if (!entityId) throw new Error('No entity found');

  const correctiveDue = HIGH_SEVERITIES.has(severity)
    ? new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().slice(0, 10)
    : null;

  const [inserted] = await db
    .insert(safetyIncidents)
    .values({
      entityId,
      occurredAt: new Date(occurredAtRaw),
      severity,
      category,
      description,
      workerId: workerIdRaw || null,
      fieldId: fieldIdRaw || null,
      lostDays: isFinite(lostDays) ? lostDays : 0,
      medicalAttentionRequired: medicalAttention,
      immediateActionTaken: immediateAction,
      photoUrls,
      correctiveActionDueOn: correctiveDue,
      status: HIGH_SEVERITIES.has(severity) ? 'investigating' : 'open',
    })
    .returning({ id: safetyIncidents.id });

  // Director notification within 1h for high-severity. Stub: write to platform_events if needed.
  // Wired via a downstream cron/edge function reading recently inserted high-severity rows.

  revalidatePath('/labor/safety');
  redirect(`/labor/safety?incidentId=${inserted?.id ?? ''}`);
}
