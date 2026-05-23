'use server';
import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { db, zakatAssessments, taxPeriods, ntnStrnRecords, ushrSettlements } from '@zameen/db';
import { computeZakat, computePunjabAit } from '@zameen/finance';
import { getSessionContext } from '@/lib/session';

function num(v: FormDataEntryValue | null, fallback = 0): number {
  if (v == null) return fallback;
  const n = Number(String(v));
  return Number.isFinite(n) ? n : fallback;
}

export async function newZakatAssessment(form: FormData): Promise<void> {
  const ctx = await getSessionContext();
  if (!ctx) throw new Error('not authenticated');
  const input = {
    nisabPkr: num(form.get('nisabPkr')),
    cashPkr: num(form.get('cashPkr')),
    bankBalancesPkr: num(form.get('bankBalancesPkr')),
    receivablesPkr: num(form.get('receivablesPkr')),
    inventoryValuePkr: num(form.get('inventoryValuePkr')),
    liquidLivestockValuePkr: num(form.get('liquidLivestockValuePkr')),
    debtsOwedPkr: num(form.get('debtsOwedPkr')),
  };
  const result = computeZakat(input);
  await db.insert(zakatAssessments).values({
    entityId: ctx.entityId,
    assessmentDate: String(form.get('assessmentDate')),
    hijriYear: num(form.get('hijriYear')),
    nisabPkr: String(input.nisabPkr),
    cashPkr: String(input.cashPkr),
    bankBalancesPkr: String(input.bankBalancesPkr),
    receivablesPkr: String(input.receivablesPkr),
    inventoryValuePkr: String(input.inventoryValuePkr),
    liquidLivestockValuePkr: String(input.liquidLivestockValuePkr),
    debtsOwedPkr: String(input.debtsOwedPkr),
    netZakatableWealthPkr: String(result.netZakatableWealthPkr),
    zakatDuePkr: String(result.zakatDuePkr),
    paidTo: (form.get('paidTo') as string) || null,
  });
  revalidatePath('/finance/tax/zakat');
}

export async function recordPunjabAit(form: FormData): Promise<void> {
  const ctx = await getSessionContext();
  if (!ctx) throw new Error('not authenticated');
  const result = computePunjabAit({
    cultivatedAcres: num(form.get('cultivatedAcres')),
    matureOrchardAcres: num(form.get('matureOrchardAcres')),
    netAgriIncomePkr: num(form.get('netAgriIncomePkr')),
  });
  await db.insert(taxPeriods).values({
    entityId: ctx.entityId,
    taxKind: 'punjab_agri_income',
    periodStart: String(form.get('periodStart')),
    periodEnd: String(form.get('periodEnd')),
    dueOn: String(form.get('dueOn')),
    computedAmountPkr: String(result.payablePkr),
    notes: `Land basis ${result.landBasisPkr} · Income basis ${result.incomeBasisPkr} · Charged on ${result.basis}`,
  });
  revalidatePath('/finance/tax/punjab-agri-income');
  revalidatePath('/finance/tax/periods');
}

export async function settleUshr(form: FormData): Promise<void> {
  const id = String(form.get('id'));
  await db.update(ushrSettlements).set({
    settledOn: String(form.get('settledOn')),
    paidTo: (form.get('paidTo') as string) || null,
    paidInKind: form.get('paidInKind') === 'on',
  }).where(eq(ushrSettlements.id, id));
  revalidatePath('/finance/tax/ushr');
}

export async function upsertNtnStrn(form: FormData): Promise<void> {
  const ctx = await getSessionContext();
  if (!ctx) throw new Error('not authenticated');
  await db.insert(ntnStrnRecords).values({
    entityId: ctx.entityId,
    ntn: (form.get('ntn') as string) || null,
    strn: (form.get('strn') as string) || null,
    fbrPrincipalActivity: (form.get('fbrPrincipalActivity') as string) || null,
    registrationDate: (form.get('registrationDate') as string) || null,
    praRegistrationId: (form.get('praRegistrationId') as string) || null,
    cnicOfPrincipal: (form.get('cnicOfPrincipal') as string) || null,
    notes: (form.get('notes') as string) || null,
  });
  revalidatePath('/finance/tax/ntn-strn');
}

export async function markTaxPaid(form: FormData): Promise<void> {
  const id = String(form.get('id'));
  await db.update(taxPeriods).set({
    filingStatus: 'paid',
    paidAmountPkr: String(num(form.get('paidAmountPkr'))),
    paidOn: String(form.get('paidOn')),
    challanNumber: (form.get('challanNumber') as string) || null,
    challanUrl: (form.get('challanUrl') as string) || null,
    filingEvidenceUrl: (form.get('filingEvidenceUrl') as string) || null,
    updatedAt: new Date(),
  }).where(eq(taxPeriods.id, id));
  revalidatePath('/finance/tax/periods');
}
