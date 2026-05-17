// Inbound WhatsApp intent dispatcher.
//
// Mirrors the field-PWA sync-dispatcher but runs in the Deno edge-function
// runtime. Inserts use the service-role Supabase client and the zameen
// schema directly so we do not need to import the Node-only
// drizzle / approvals packages here. Threshold checks for diesel purchases
// are done locally; if exceeded, an approval_requests row is created and
// the requester is told so in the reply.

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.46.1';
import type { ParsedIntent } from '../../../packages/shared/src/nlu.ts';
import {
  clarificationMessage,
  confirmDieselLog,
  confirmHarvest,
  confirmMilk,
  confirmRepairRequest,
  confirmTaskCompletion,
  pickLocale,
  replies,
  type Locale,
} from './replies.ts';
import { pktTodayIso } from '../_shared/supabase.ts';

// Local mirror of @zameen/shared DEFAULT_APPROVAL_THRESHOLDS_PKR for
// diesel_purchase. Kept in sync intentionally; long-form thresholds live in
// packages/shared/src/constants.ts.
const DIESEL_PURCHASE_THRESHOLDS = { supervisor: 25_000, farm_manager: 50_000 };

function exceedsDieselThreshold(amountPkr: number): boolean {
  return amountPkr > DIESEL_PURCHASE_THRESHOLDS.supervisor;
}

function nextNumber(prefix: string): string {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}`;
}

export interface ZameenUser {
  id: string;
  default_entity_id: string | null;
  primary_role: string;
  preferred_locale: string;
  full_name: string;
  phone: string | null;
}

export interface ProcessResult {
  reply: string;
  status: 'ok' | 'clarify' | 'error' | 'unknown';
}

export async function processIntent(args: {
  supabase: SupabaseClient;
  user: ZameenUser;
  intent: ParsedIntent;
}): Promise<ProcessResult> {
  const { supabase, user, intent } = args;
  const locale = (user.preferred_locale ?? 'ur') as Locale;

  if (intent.intent === 'unknown' || intent.confidence < 0.5) {
    return { reply: pickLocale(replies.lowConfidence, locale), status: 'unknown' };
  }

  if (intent.needsClarification && intent.needsClarification.length > 0) {
    return {
      reply: clarificationMessage(intent.needsClarification, locale),
      status: 'clarify',
    };
  }

  const entityId = user.default_entity_id;
  if (!entityId) {
    return { reply: pickLocale(replies.internalError, locale), status: 'error' };
  }

  try {
    switch (intent.intent) {
      case 'task_completion':
        return await handleTaskCompletion(supabase, user, entityId, intent, locale);
      case 'diesel_log':
        return await handleDieselLog(supabase, user, entityId, intent, locale);
      case 'diesel_purchase':
        return await handleDieselPurchase(supabase, user, entityId, intent, locale);
      case 'repair_report':
        return await handleRepairReport(supabase, user, entityId, intent, locale);
      case 'harvest_log':
        return await handleHarvestLog(supabase, user, entityId, intent, locale);
      case 'milk_log':
        return await handleMilkLog(supabase, user, intent, locale);
      case 'attendance_check_in':
        return await handleAttendance(supabase, user, entityId, intent, 'in', locale);
      case 'attendance_check_out':
        return await handleAttendance(supabase, user, entityId, intent, 'out', locale);
      case 'comment':
        return await handleComment(supabase, user, intent, locale);
      default:
        return { reply: pickLocale(replies.lowConfidence, locale), status: 'unknown' };
    }
  } catch (err) {
    console.error('processIntent error', err);
    return { reply: pickLocale(replies.internalError, locale), status: 'error' };
  }
}

function str(intent: ParsedIntent, key: string): string | undefined {
  const v = intent.fields[key];
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

function num(intent: ParsedIntent, key: string): number | undefined {
  const v = intent.fields[key];
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) return Number(v);
  return undefined;
}

async function findWorker(supabase: SupabaseClient, userId: string): Promise<string | null> {
  const { data } = await supabase.from('workers').select('id').eq('user_id', userId).limit(1).maybeSingle();
  return (data as { id?: string } | null)?.id ?? null;
}

async function handleTaskCompletion(
  supabase: SupabaseClient,
  user: ZameenUser,
  _entityId: string,
  intent: ParsedIntent,
  locale: Locale,
): Promise<ProcessResult> {
  const taskCode = str(intent, 'taskCode');
  if (!taskCode) {
    return {
      reply: clarificationMessage([{ field: 'taskCode', question: 'کونسا ٹاسک؟ Which task code?' }], locale),
      status: 'clarify',
    };
  }
  const { data: task } = await supabase
    .from('tasks')
    .select('id, title')
    .eq('id', taskCode)
    .maybeSingle();
  if (!task) {
    return { reply: pickLocale(replies.lowConfidence, locale), status: 'unknown' };
  }
  const workerId = await findWorker(supabase, user.id);
  if (!workerId) {
    return { reply: pickLocale(replies.internalError, locale), status: 'error' };
  }
  const hoursWorked = num(intent, 'hoursWorked');
  await supabase.from('task_completions').insert({
    task_id: (task as { id: string }).id,
    worker_id: workerId,
    hours_worked: hoursWorked?.toString() ?? null,
    notes: str(intent, 'notes') ?? null,
    proof_photo_urls: [],
  });
  await supabase.from('tasks').update({ status: 'done' }).eq('id', (task as { id: string }).id);
  return {
    reply: confirmTaskCompletion((task as { title: string }).title, locale),
    status: 'ok',
  };
}

async function handleDieselLog(
  supabase: SupabaseClient,
  user: ZameenUser,
  entityId: string,
  intent: ParsedIntent,
  locale: Locale,
): Promise<ProcessResult> {
  const assetId = str(intent, 'assetId');
  const litres = num(intent, 'litres');
  if (!assetId || !litres) {
    return {
      reply: clarificationMessage(
        [{ field: !assetId ? 'assetId' : 'litres', question: 'مشین اور لیٹر بتائیں / Which machine and how many litres?' }],
        locale,
      ),
      status: 'clarify',
    };
  }
  const hoursRun = num(intent, 'hoursRun') ?? 0;
  const ratePerLitrePkr = num(intent, 'ratePerLitrePkr') ?? 300;
  const totalCostPkr = num(intent, 'totalCostPkr') ?? Math.round(litres * ratePerLitrePkr);

  const { data: asset } = await supabase
    .from('assets')
    .select('current_hour_meter')
    .eq('id', assetId)
    .maybeSingle();
  const meterStart = asset ? Number((asset as { current_hour_meter: string }).current_hour_meter) : 0;
  const meterEnd = meterStart + hoursRun;

  await supabase.from('diesel_daily_logs').insert({
    entity_id: entityId,
    asset_id: assetId,
    log_date: pktTodayIso(),
    operator_id: user.id,
    operator_name: user.full_name,
    hour_meter_start: meterStart.toString(),
    hour_meter_end: meterEnd.toString(),
    hours_run: hoursRun.toString(),
    diesel_filled_liters: litres.toString(),
    rate_liter_pkr: ratePerLitrePkr.toString(),
    total_cost_pkr: totalCostPkr.toString(),
    task_field_id: str(intent, 'fieldId') ?? null,
    task_kind: str(intent, 'taskKind') ?? null,
    receipt_photo_urls: [],
    created_by: user.id,
  });

  // Try to surface tank remaining stock if a source tank is configurable
  let remaining: number | null = null;
  const { data: tank } = await supabase
    .from('fuel_storage_tanks')
    .select('current_stock_liters')
    .eq('entity_id', entityId)
    .limit(1)
    .maybeSingle();
  if (tank) {
    remaining = Number((tank as { current_stock_liters: string }).current_stock_liters);
  }

  return {
    reply: confirmDieselLog({ litres, totalPkr: totalCostPkr, remainingTankLitres: remaining, locale }),
    status: 'ok',
  };
}

async function handleDieselPurchase(
  supabase: SupabaseClient,
  user: ZameenUser,
  entityId: string,
  intent: ParsedIntent,
  locale: Locale,
): Promise<ProcessResult> {
  const litres = num(intent, 'litres');
  const totalPkr = num(intent, 'totalPkr');
  if (!litres || !totalPkr) {
    return {
      reply: clarificationMessage(
        [{ field: 'totalPkr', question: 'کتنے روپے اور کتنے لیٹر؟ How many PKR and litres?' }],
        locale,
      ),
      status: 'clarify',
    };
  }
  const ratePerLitrePkr = num(intent, 'ratePerLitrePkr') ?? Number((totalPkr / litres).toFixed(2));
  const { data: purchase } = await supabase
    .from('diesel_purchases')
    .insert({
      entity_id: entityId,
      purchased_at: new Date().toISOString(),
      vendor_name: str(intent, 'vendorName') ?? 'unspecified',
      quantity_liters: litres.toString(),
      rate_liter_pkr: ratePerLitrePkr.toString(),
      total_pkr: totalPkr.toString(),
      payment_method: 'cash',
      receipt_photo_urls: [],
      created_by: user.id,
      notes: 'submitted via WhatsApp NLU',
    })
    .select('id')
    .single();

  if (exceedsDieselThreshold(totalPkr) && purchase) {
    await supabase.from('approval_requests').insert({
      entity_id: entityId,
      approval_type: 'diesel_purchase',
      state: 'submitted',
      source_module: 'diesel',
      source_record_id: (purchase as { id: string }).id,
      title: `Diesel purchase ${litres} L (WhatsApp)`,
      amount_pkr: totalPkr.toString(),
      payload: { litres, totalPkr, source: 'whatsapp' },
      requested_by: user.id,
      submitted_at: new Date().toISOString(),
    });
  }

  return { reply: pickLocale(replies.dieselPurchaseOk, locale), status: 'ok' };
}

async function handleRepairReport(
  supabase: SupabaseClient,
  user: ZameenUser,
  entityId: string,
  intent: ParsedIntent,
  locale: Locale,
): Promise<ProcessResult> {
  const assetId = str(intent, 'assetId');
  const issue = str(intent, 'issue');
  if (!assetId || !issue) {
    return {
      reply: clarificationMessage(
        [{ field: !assetId ? 'assetId' : 'issue', question: 'کونسی مشین، کیا خرابی؟ Which asset and what issue?' }],
        locale,
      ),
      status: 'clarify',
    };
  }
  const requestNumber = nextNumber('RR');
  const severity = str(intent, 'severity') ?? 'minor';
  await supabase.from('repair_requests').insert({
    entity_id: entityId,
    asset_id: assetId,
    request_number: requestNumber,
    reported_by: user.id,
    issue_description: issue,
    severity,
    problem_photo_urls: [],
    status: 'reported',
  });
  return { reply: confirmRepairRequest(requestNumber, locale), status: 'ok' };
}

async function handleHarvestLog(
  supabase: SupabaseClient,
  user: ZameenUser,
  _entityId: string,
  intent: ParsedIntent,
  locale: Locale,
): Promise<ProcessResult> {
  const fieldId = str(intent, 'fieldId');
  let grossYieldKg = num(intent, 'grossYieldKg');
  const mann = num(intent, 'grossYieldMann');
  if (!grossYieldKg && mann) grossYieldKg = Math.round(mann * 37.32);
  if (!fieldId || !grossYieldKg) {
    return {
      reply: clarificationMessage(
        [{ field: 'yield', question: 'کونسا کھیت اور کتنا یلڈ؟ Which field and how much yield?' }],
        locale,
      ),
      status: 'clarify',
    };
  }
  const { data: cropPlan } = await supabase
    .from('crop_plans')
    .select('id')
    .eq('field_id', fieldId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!cropPlan) {
    return { reply: pickLocale(replies.lowConfidence, locale), status: 'unknown' };
  }
  const acresHarvested = num(intent, 'acresHarvested') ?? 1;
  await supabase.from('harvest_records').insert({
    crop_plan_id: (cropPlan as { id: string }).id,
    harvested_on: new Date().toISOString(),
    acres_harvested: acresHarvested.toString(),
    gross_yield_kg: grossYieldKg.toString(),
    notes: `WhatsApp by ${user.full_name}`,
  });
  return { reply: confirmHarvest(grossYieldKg, locale), status: 'ok' };
}

async function handleMilkLog(
  supabase: SupabaseClient,
  user: ZameenUser,
  intent: ParsedIntent,
  locale: Locale,
): Promise<ProcessResult> {
  const animalId = str(intent, 'animalId');
  const earTag = str(intent, 'animalEarTag');
  const litres = num(intent, 'litres');
  if (!litres || (!animalId && !earTag)) {
    return {
      reply: clarificationMessage(
        [{ field: 'animal', question: 'کونسی بھینس/گائے اور کتنے لیٹر؟ Which animal and how many litres?' }],
        locale,
      ),
      status: 'clarify',
    };
  }
  let resolvedAnimalId = animalId;
  if (!resolvedAnimalId && earTag) {
    const { data: animal } = await supabase
      .from('animals')
      .select('id')
      .eq('ear_tag', earTag)
      .maybeSingle();
    resolvedAnimalId = (animal as { id?: string } | null)?.id;
  }
  if (!resolvedAnimalId) {
    return { reply: pickLocale(replies.lowConfidence, locale), status: 'unknown' };
  }
  const session = str(intent, 'session') ?? 'am';
  await supabase.from('milk_records').insert({
    animal_id: resolvedAnimalId,
    recorded_on: pktTodayIso(),
    session,
    litres: litres.toString(),
    recorded_by: user.id,
  });
  return { reply: confirmMilk(litres, locale), status: 'ok' };
}

async function handleAttendance(
  supabase: SupabaseClient,
  user: ZameenUser,
  entityId: string,
  _intent: ParsedIntent,
  direction: 'in' | 'out',
  locale: Locale,
): Promise<ProcessResult> {
  const workerId = await findWorker(supabase, user.id);
  if (!workerId) return { reply: pickLocale(replies.internalError, locale), status: 'error' };
  const today = pktTodayIso();
  const nowIso = new Date().toISOString();

  if (direction === 'in') {
    const { data: existing } = await supabase
      .from('attendance_records')
      .select('id')
      .eq('worker_id', workerId)
      .eq('work_date', today)
      .maybeSingle();
    if (existing) {
      await supabase
        .from('attendance_records')
        .update({ check_in_at: nowIso, within_geofence: null, source: 'whatsapp' })
        .eq('id', (existing as { id: string }).id);
    } else {
      await supabase.from('attendance_records').insert({
        worker_id: workerId,
        entity_id: entityId,
        work_date: today,
        status: 'present',
        check_in_at: nowIso,
        check_in_gps: null,
        within_geofence: null,
        source: 'whatsapp',
      });
    }
    return { reply: pickLocale(replies.attendanceInOk, locale), status: 'ok' };
  }

  await supabase
    .from('attendance_records')
    .update({ check_out_at: nowIso })
    .eq('worker_id', workerId)
    .eq('work_date', today);
  return { reply: pickLocale(replies.attendanceOutOk, locale), status: 'ok' };
}

async function handleComment(
  supabase: SupabaseClient,
  user: ZameenUser,
  intent: ParsedIntent,
  locale: Locale,
): Promise<ProcessResult> {
  const taskCode = str(intent, 'taskCode');
  const body = str(intent, 'body') ?? intent.rawText;
  if (!taskCode) {
    return { reply: pickLocale(replies.lowConfidence, locale), status: 'unknown' };
  }
  const { data: task } = await supabase.from('tasks').select('id').eq('id', taskCode).maybeSingle();
  if (!task) return { reply: pickLocale(replies.lowConfidence, locale), status: 'unknown' };
  await supabase.from('entity_comments').insert({
    entity_kind: 'task',
    entity_id: (task as { id: string }).id,
    author_id: user.id,
    body,
    mentions: [],
    attachments: [],
  });
  return { reply: pickLocale(replies.commentOk, locale), status: 'ok' };
}
