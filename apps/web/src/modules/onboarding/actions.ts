'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import {
  db,
  entities,
  entitySettings,
  accounts,
  approvalWorkflows,
  users,
  userEntityRoles,
  farms,
  blocks,
  fields,
  cropPlans,
  digestSubscriptions,
  onboardingDrafts,
  automationRecipes,
} from '@zameen/db';
import { APPROVAL_TYPES, DEFAULT_APPROVAL_THRESHOLDS_PKR } from '@zameen/shared';
import { getSessionContext } from '@/lib/session';
import type {
  WizardState,
  WizardEntityStep,
  WizardLandStep,
  WizardPersonDraft,
  WizardDigestPrefDraft,
} from './types';

export async function saveDraftState(draftId: string | null, state: WizardState): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  try {
    if (draftId) {
      await db
        .update(onboardingDrafts)
        .set({ state, step: state.step, updatedAt: new Date() })
        .where(eq(onboardingDrafts.id, draftId));
      return { ok: true, id: draftId };
    }
    const [row] = await db
      .insert(onboardingDrafts)
      .values({ createdBy: ctx.userId, state, step: state.step })
      .returning({ id: onboardingDrafts.id });
    return { ok: true, id: row!.id };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function createEntityFromWizard(input: WizardEntityStep): Promise<{ ok: true; entityId: string } | { ok: false; error: string }> {
  if (input.mode === 'existing' && input.existingEntityId) return { ok: true, entityId: input.existingEntityId };
  if (!input.code || !input.name) return { ok: false, error: 'code and name required' };

  try {
    return await db.transaction(async (tx) => {
      const [e] = await tx
        .insert(entities)
        .values({
          code: input.code!,
          name: input.name!,
          legalName: input.legalName ?? null,
          kind: input.kind ?? 'proprietorship',
          ntn: input.ntn ?? null,
          registeredAddress: input.registeredAddress ?? null,
          approvalThresholds: input.approvalThresholdsPkr ?? DEFAULT_APPROVAL_THRESHOLDS_PKR,
          settings: {},
        })
        .returning({ id: entities.id });
      const entityId = e!.id;

      await tx.insert(entitySettings).values({
        entityId,
        fiscalYearStartMonth: input.fiscalYearStartMonth ?? '07',
        defaultLocale: 'ur',
        approvalThresholds: input.approvalThresholdsPkr ?? DEFAULT_APPROVAL_THRESHOLDS_PKR,
      });

      const coa = [
        { code: '1000', name: 'Cash', accountType: 'asset' },
        { code: '1100', name: 'Bank', accountType: 'asset' },
        { code: '1200', name: 'Accounts receivable', accountType: 'asset' },
        { code: '1500', name: 'Inventory', accountType: 'asset' },
        { code: '1700', name: 'Fixed assets', accountType: 'asset' },
        { code: '2000', name: 'Accounts payable', accountType: 'liability' },
        { code: '3000', name: "Owner's equity", accountType: 'equity' },
        { code: '4000', name: 'Revenue', accountType: 'revenue' },
        { code: '5100', name: 'Seed', accountType: 'expense', costPool: 'seed' },
        { code: '5200', name: 'Fertilizer', accountType: 'expense', costPool: 'fertilizer' },
        { code: '5300', name: 'Pesticide', accountType: 'expense', costPool: 'pesticide' },
        { code: '5400', name: 'Diesel', accountType: 'expense', costPool: 'diesel' },
        { code: '5500', name: 'Field labor', accountType: 'expense', costPool: 'labor_field' },
        { code: '5600', name: 'Repairs', accountType: 'expense', costPool: 'repairs' },
        { code: '5700', name: 'Land rent', accountType: 'expense', costPool: 'land_rent' },
      ];
      for (const a of coa) {
        await tx.insert(accounts).values({ ...a, entityId });
      }

      const thresholds = input.approvalThresholdsPkr ?? DEFAULT_APPROVAL_THRESHOLDS_PKR;
      for (const t of APPROVAL_TYPES) {
        await tx.insert(approvalWorkflows).values({
          entityId,
          approvalType: t,
          thresholdsPkr: thresholds[t] ?? DEFAULT_APPROVAL_THRESHOLDS_PKR[t],
          isActive: true,
        });
      }

      return { ok: true, entityId };
    });
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function createFarmFromWizard(entityId: string, land: WizardLandStep): Promise<{ ok: true; farmId: string } | { ok: false; error: string }> {
  if (!land.farmCode || !land.farmName) return { ok: false, error: 'farm code and name required' };
  try {
    return await db.transaction(async (tx) => {
      const [farm] = await tx
        .insert(farms)
        .values({
          entityId,
          code: land.farmCode!,
          name: land.farmName!,
          district: land.district ?? null,
          tehsil: land.tehsil ?? null,
          village: land.village ?? null,
          centroid:
            land.centroidLat != null && land.centroidLon != null
              ? { type: 'Point', coordinates: [land.centroidLon, land.centroidLat] }
              : null,
          totalAcres: land.totalAcres != null ? String(land.totalAcres) : null,
        })
        .returning({ id: farms.id });
      const farmId = farm!.id;

      const blockIdByCode = new Map<string, string>();
      for (const b of land.blocks) {
        const [inserted] = await tx
          .insert(blocks)
          .values({
            farmId,
            code: b.code,
            name: b.name ?? null,
            acres: b.acres != null ? String(b.acres) : null,
            geometry: (b.geometryGeoJson ?? null) as never,
          })
          .returning({ id: blocks.id });
        blockIdByCode.set(b.code, inserted!.id);
      }

      for (const f of land.fields) {
        const blockId = blockIdByCode.get(f.blockCode);
        if (!blockId) throw new Error(`Field ${f.code} references unknown block ${f.blockCode}`);
        await tx.insert(fields).values({
          blockId,
          code: f.code,
          name: f.name,
          acres: String(f.acres),
          geometry: f.geometryGeoJson as never,
          tenure: 'owned',
        });
      }

      return { ok: true, farmId };
    });
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function addPilotUsers(entityId: string, people: WizardPersonDraft[]): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  try {
    let count = 0;
    for (const p of people) {
      const [u] = await db
        .insert(users)
        .values({
          fullName: p.fullName,
          phone: p.phone ?? null,
          email: p.email ?? null,
          primaryRole: p.role,
          defaultEntityId: entityId,
        })
        .returning({ id: users.id });
      await db.insert(userEntityRoles).values({
        userId: u!.id,
        entityId,
        role: p.role,
      });
      count += 1;
    }
    return { ok: true, count };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function enableRecommendedAutomations(entityId: string): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  try {
    const recipes = [
      { name: 'Diesel anomaly alert', triggerKind: 'anomaly_detected' },
      { name: 'Approval escalation 24h', triggerKind: 'approval_pending' },
      { name: 'Task due reminder', triggerKind: 'task_due_soon' },
      { name: 'Inventory low warning', triggerKind: 'inventory_low' },
      { name: 'Repair quote needed', triggerKind: 'repair_pending_quote' },
      { name: 'Weekly cost summary', triggerKind: 'weekly_tick' },
    ];
    for (const r of recipes) {
      await db.insert(automationRecipes).values({
        entityId,
        name: r.name,
        triggerKind: r.triggerKind,
        triggerConfig: {},
        actions: [],
        enabled: true,
      });
    }
    return { ok: true, count: recipes.length };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function enableDigests(entityId: string, prefs: WizardDigestPrefDraft[]): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  try {
    for (const p of prefs) {
      await db.insert(digestSubscriptions).values({
        entityId,
        channel: p.channel,
        kind: p.kind,
        target: p.target,
        sendTimeLocal: p.sendTimeLocal,
        timezone: p.timezone,
        createdBy: ctx.userId,
      });
    }
    return { ok: true, count: prefs.length };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export interface FinalizeResult {
  ok: boolean;
  log: string[];
  error?: string;
  entityId?: string;
  farmId?: string;
}

export async function finalizeOnboarding(draftId: string, state: WizardState): Promise<FinalizeResult> {
  const log: string[] = [];
  try {
    const entityRes = await createEntityFromWizard(state.entityStep);
    if (!entityRes.ok) return { ok: false, log, error: entityRes.error };
    log.push(`Entity ready: ${entityRes.entityId}`);

    const farmRes = await createFarmFromWizard(entityRes.entityId, state.landStep);
    if (!farmRes.ok) return { ok: false, log, error: farmRes.error };
    log.push(`Farm created: ${farmRes.farmId}`);

    const peopleRes = await addPilotUsers(entityRes.entityId, state.peopleStep.people);
    if (!peopleRes.ok) return { ok: false, log, error: peopleRes.error };
    log.push(`Added ${peopleRes.count} people`);

    if (state.automationStep.recommendedAutomationsEnabled) {
      const autoRes = await enableRecommendedAutomations(entityRes.entityId);
      if (!autoRes.ok) return { ok: false, log, error: autoRes.error };
      log.push(`Enabled ${autoRes.count} automations`);
    }

    if (state.automationStep.digestPrefs.length > 0) {
      const dRes = await enableDigests(entityRes.entityId, state.automationStep.digestPrefs);
      if (!dRes.ok) return { ok: false, log, error: dRes.error };
      log.push(`Created ${dRes.count} digest subscriptions`);
    }

    // Create crop plans best-effort, mapping field codes to ids.
    if (state.cropsStep.plans.length > 0) {
      const fieldRows = await db
        .select({ id: fields.id, code: fields.code, blockId: fields.blockId })
        .from(fields)
        .innerJoin(blocks, eq(blocks.id, fields.blockId))
        .where(eq(blocks.farmId, farmRes.farmId));
      const fieldByCode = new Map(fieldRows.map((f) => [f.code, f.id]));
      for (const plan of state.cropsStep.plans) {
        const fid = fieldByCode.get(plan.fieldCode);
        if (!fid) continue;
        await db.insert(cropPlans).values({
          entityId: entityRes.entityId,
          fieldId: fid,
          cropProfileId: plan.cropProfileId,
          plannedSowingDate: plan.plannedSowingDate ?? null,
          currentStage: 'planning',
        });
      }
      log.push(`Created ${state.cropsStep.plans.length} crop plans`);
    }

    await db
      .update(onboardingDrafts)
      .set({ finalizedAt: new Date(), state, step: 5 })
      .where(eq(onboardingDrafts.id, draftId));
    log.push('Draft finalized');

    revalidatePath('/admin/entities');
    revalidatePath('/admin/digests');

    return { ok: true, log, entityId: entityRes.entityId, farmId: farmRes.farmId };
  } catch (err) {
    log.push(`Error: ${(err as Error).message}`);
    return { ok: false, log, error: (err as Error).message };
  }
}
