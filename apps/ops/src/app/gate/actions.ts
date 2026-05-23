'use server';

import { revalidatePath } from 'next/cache';
import { and, eq, sql, isNull } from 'drizzle-orm';
import { db, visitors, diseaseOutbreaks, biosecurityProtocols, quarantineRecords } from '@zameen/db';
import { getSessionContext } from '@/lib/session';

type Result<T = { id: string }> = ({ ok: true } & T) | { ok: false; error: string };

const VISIT_PURPOSES = [
  'inspection',
  'vendor_meeting',
  'vendor_delivery',
  'vet_visit',
  'buyer',
  'contractor',
  'researcher',
  'training',
  'tour',
  'government',
  'family',
  'other',
] as const;

export async function signInVisitor(input: {
  visitorName: string;
  cnic?: string;
  phone?: string;
  organization?: string;
  vehicleRegistration?: string;
  visitPurpose: string;
  fieldsVisited?: string[];
  livestockAreasVisited?: boolean;
  photoIdUrl?: string;
  signatureUrl?: string;
  healthDeclarationSigned: boolean;
  notes?: string;
}): Promise<Result<{ id: string; biosecurityCheckPassed: boolean; failures: string[] }>> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  if (!input.visitorName || input.visitorName.trim().length < 2) return { ok: false, error: 'Visitor name required' };
  if (!VISIT_PURPOSES.includes(input.visitPurpose as (typeof VISIT_PURPOSES)[number])) {
    return { ok: false, error: 'Invalid visit purpose' };
  }
  if (!input.healthDeclarationSigned) return { ok: false, error: 'Health declaration must be signed' };

  const failures: string[] = [];

  // Block visit to livestock areas if active livestock-relevant outbreak.
  if (input.livestockAreasVisited) {
    const livestockOutbreakKinds = ['fmd', 'lsd', 'brucellosis', 'mastitis', 'avian_flu', 'newcastle', 'ppr', 'anthrax', 'clostridial'];
    const active = await db
      .select({ id: diseaseOutbreaks.id, kind: diseaseOutbreaks.outbreakKind })
      .from(diseaseOutbreaks)
      .where(
        and(
          eq(diseaseOutbreaks.entityId, ctx.entityId),
          sql`${diseaseOutbreaks.status} in ('suspected','active')`,
          sql`${diseaseOutbreaks.outbreakKind} = any(${livestockOutbreakKinds})`,
        ),
      );
    if (active.length > 0) {
      failures.push(`Active livestock outbreak (${active.map((a) => a.kind).join(', ')}) — livestock area access blocked`);
    }
  }

  // Mandatory protocols for visitors.
  const mandatory = await db
    .select()
    .from(biosecurityProtocols)
    .where(
      and(
        eq(biosecurityProtocols.entityId, ctx.entityId),
        eq(biosecurityProtocols.enforcementLevel, 'mandatory'),
        eq(biosecurityProtocols.isActive, true),
        sql`'visitors' = any(${biosecurityProtocols.appliesTo})`,
      ),
    );
  for (const p of mandatory) {
    if (p.protocolKind === 'health_certification' && !input.healthDeclarationSigned) {
      failures.push(`Mandatory: ${p.protocolName}`);
    }
    if (p.protocolKind === 'vehicle_wash' && input.vehicleRegistration && !input.notes?.toLowerCase().includes('wash')) {
      failures.push(`Mandatory vehicle wash for ${p.protocolName}`);
    }
  }

  const passed = failures.length === 0;
  if (!passed && input.livestockAreasVisited) {
    return { ok: false, error: failures.join('; ') };
  }

  const [row] = await db
    .insert(visitors)
    .values({
      entityId: ctx.entityId,
      visitorName: input.visitorName,
      cnic: input.cnic,
      phone: input.phone,
      organization: input.organization,
      vehicleRegistration: input.vehicleRegistration,
      visitPurpose: input.visitPurpose,
      fieldsVisited: input.fieldsVisited,
      livestockAreasVisited: input.livestockAreasVisited ?? false,
      biosecurityCheckPassed: passed,
      biosecurityFailures: failures.length ? failures : null,
      photoIdUrl: input.photoIdUrl,
      signatureUrl: input.signatureUrl,
      healthDeclarationSigned: input.healthDeclarationSigned,
      notes: input.notes,
    })
    .returning({ id: visitors.id });

  revalidatePath('/gate');
  return { ok: true, id: row.id, biosecurityCheckPassed: passed, failures };
}

export async function signOutVisitor(visitorId: string): Promise<Result> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  await db
    .update(visitors)
    .set({ signedOutAt: new Date() })
    .where(and(eq(visitors.id, visitorId), eq(visitors.entityId, ctx.entityId), isNull(visitors.signedOutAt)));
  revalidatePath('/gate');
  return { ok: true, id: visitorId };
}

export async function createProtocol(input: {
  zone: string;
  protocolName: string;
  protocolKind: string;
  description?: string;
  enforcementLevel: string;
  appliesTo?: string[];
}): Promise<Result> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  const [row] = await db
    .insert(biosecurityProtocols)
    .values({
      entityId: ctx.entityId,
      zone: input.zone,
      protocolName: input.protocolName,
      protocolKind: input.protocolKind,
      description: input.description,
      enforcementLevel: input.enforcementLevel,
      appliesTo: input.appliesTo ?? ['visitors', 'workers', 'vehicles'],
    })
    .returning({ id: biosecurityProtocols.id });
  revalidatePath('/biosecurity/protocols');
  return { ok: true, id: row.id };
}

export async function toggleProtocol(id: string, isActive: boolean): Promise<Result> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  await db
    .update(biosecurityProtocols)
    .set({ isActive })
    .where(and(eq(biosecurityProtocols.id, id), eq(biosecurityProtocols.entityId, ctx.entityId)));
  revalidatePath('/biosecurity/protocols');
  return { ok: true, id };
}

export async function createOutbreak(input: {
  outbreakKind: string;
  detectedOn: string;
  affectedArea?: string;
  affectedAnimalIds?: string[];
  affectedFieldIds?: string[];
  sourceSuspected?: string;
  totalAffectedCount?: number;
  notes?: string;
}): Promise<Result> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };

  const [row] = await db
    .insert(diseaseOutbreaks)
    .values({
      entityId: ctx.entityId,
      outbreakKind: input.outbreakKind,
      detectedOn: input.detectedOn,
      affectedArea: input.affectedArea,
      affectedAnimalIds: input.affectedAnimalIds,
      affectedFieldIds: input.affectedFieldIds,
      sourceSuspected: input.sourceSuspected,
      totalAffectedCount: input.totalAffectedCount,
      status: 'active',
      notes: input.notes,
    })
    .returning({ id: diseaseOutbreaks.id });

  // Auto-create quarantine record for affected animals or fields.
  if (input.affectedAnimalIds && input.affectedAnimalIds.length > 0) {
    for (const aid of input.affectedAnimalIds) {
      await db.insert(quarantineRecords).values({
        entityId: ctx.entityId,
        subjectKind: 'animal',
        subjectId: aid,
        reason: `Outbreak: ${input.outbreakKind}`,
        relatedOutbreakId: row.id,
        startDate: input.detectedOn,
        status: 'active',
      });
    }
  }
  if (input.affectedFieldIds && input.affectedFieldIds.length > 0) {
    for (const fid of input.affectedFieldIds) {
      await db.insert(quarantineRecords).values({
        entityId: ctx.entityId,
        subjectKind: 'field',
        subjectId: fid,
        reason: `Outbreak: ${input.outbreakKind}`,
        relatedOutbreakId: row.id,
        startDate: input.detectedOn,
        status: 'active',
      });
    }
  }

  revalidatePath('/biosecurity/outbreaks');
  revalidatePath('/biosecurity/quarantine');
  return { ok: true, id: row.id };
}

export async function setOutbreakStatus(id: string, status: string, endedOn?: string): Promise<Result> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  await db
    .update(diseaseOutbreaks)
    .set({
      status,
      containmentEndedOn: status === 'resolved' || status === 'contained' ? (endedOn ?? new Date().toISOString().slice(0, 10)) : null,
    })
    .where(and(eq(diseaseOutbreaks.id, id), eq(diseaseOutbreaks.entityId, ctx.entityId)));
  revalidatePath('/biosecurity/outbreaks');
  return { ok: true, id };
}

export async function releaseQuarantine(id: string, releaseNotes?: string): Promise<Result> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  await db
    .update(quarantineRecords)
    .set({
      status: 'released',
      endDate: new Date().toISOString().slice(0, 10),
      releasedBy: ctx.userId,
      releaseNotes,
    })
    .where(and(eq(quarantineRecords.id, id), eq(quarantineRecords.entityId, ctx.entityId)));
  revalidatePath('/biosecurity/quarantine');
  return { ok: true, id };
}
