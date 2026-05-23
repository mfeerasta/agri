'use server';

import { db, soilSamplingEvents, soilHealthCards } from '@zameen/db';
import { revalidatePath } from 'next/cache';

export interface CreateSamplingEventInput {
  fieldId: string;
  sampledOn: string;
  samplingMethod:
    | 'grid_systematic'
    | 'random'
    | 'zone_based'
    | 'composite_w'
    | 'single_point';
  sampleCount: number;
  depthCm: number;
  gpsLocations: Array<{ lat: number; lng: number; label?: string }>;
  sentToLab?: string;
  labReferenceNumber?: string;
  expectedResultDate?: string;
  notes?: string;
  photoUrls?: string[];
  costPkr?: number;
}

export async function createSamplingEvent(input: CreateSamplingEventInput) {
  const [row] = await db
    .insert(soilSamplingEvents)
    .values({
      fieldId: input.fieldId,
      sampledOn: input.sampledOn,
      samplingMethod: input.samplingMethod,
      sampleCount: input.sampleCount,
      depthCm: input.depthCm,
      gpsLocations: input.gpsLocations,
      sentToLab: input.sentToLab,
      labReferenceNumber: input.labReferenceNumber,
      expectedResultDate: input.expectedResultDate,
      notes: input.notes,
      photoUrls: input.photoUrls ?? [],
      costPkr: input.costPkr !== undefined ? String(input.costPkr) : null,
      status: 'collected',
    })
    .returning({ id: soilSamplingEvents.id });

  revalidatePath('/land/soil-sampling');
  return row;
}

export interface CreateSoilHealthCardInput {
  fieldId: string;
  cardNumber: string;
  issuedOn: string;
  validUntil: string;
  laboratory?: string;
  laboratoryCertificateUrl?: string;
  compositeSampleCount?: number;
  ph?: number;
  electricalConductivityDsPerM?: number;
  organicMatterPct?: number;
  organicCarbonPct?: number;
  cecCmolPerKg?: number;
  nitrogenTotalPct?: number;
  phosphorusAvailPpm?: number;
  potassiumAvailPpm?: number;
  sulphurPpm?: number;
  zincPpm?: number;
  ironPpm?: number;
  manganesePpm?: number;
  copperPpm?: number;
  boronPpm?: number;
  textureClass?:
    | 'sand'
    | 'loamy_sand'
    | 'sandy_loam'
    | 'loam'
    | 'silt_loam'
    | 'silt'
    | 'sandy_clay_loam'
    | 'clay_loam'
    | 'silty_clay_loam'
    | 'sandy_clay'
    | 'silty_clay'
    | 'clay';
  clayPct?: number;
  sandPct?: number;
  siltPct?: number;
  bulkDensityGPerCm3?: number;
  infiltrationRateCmPerHr?: number;
  carbonatePct?: number;
  salinityClass?:
    | 'non_saline'
    | 'slightly_saline'
    | 'moderately_saline'
    | 'strongly_saline'
    | 'very_strongly_saline';
  sodicityClass?:
    | 'non_sodic'
    | 'slightly_sodic'
    | 'moderately_sodic'
    | 'strongly_sodic';
  aiSummary?: string;
  aiSummaryUr?: string;
  fullReportUrl?: string;
}

function numStr(v: number | undefined): string | null {
  return v === undefined || v === null ? null : String(v);
}

export async function createSoilHealthCard(input: CreateSoilHealthCardInput) {
  const [row] = await db
    .insert(soilHealthCards)
    .values({
      fieldId: input.fieldId,
      cardNumber: input.cardNumber,
      issuedOn: input.issuedOn,
      validUntil: input.validUntil,
      laboratory: input.laboratory,
      laboratoryCertificateUrl: input.laboratoryCertificateUrl,
      compositeSampleCount: input.compositeSampleCount,
      ph: numStr(input.ph),
      electricalConductivityDsPerM: numStr(input.electricalConductivityDsPerM),
      organicMatterPct: numStr(input.organicMatterPct),
      organicCarbonPct: numStr(input.organicCarbonPct),
      cecCmolPerKg: numStr(input.cecCmolPerKg),
      nitrogenTotalPct: numStr(input.nitrogenTotalPct),
      phosphorusAvailPpm: numStr(input.phosphorusAvailPpm),
      potassiumAvailPpm: numStr(input.potassiumAvailPpm),
      sulphurPpm: numStr(input.sulphurPpm),
      zincPpm: numStr(input.zincPpm),
      ironPpm: numStr(input.ironPpm),
      manganesePpm: numStr(input.manganesePpm),
      copperPpm: numStr(input.copperPpm),
      boronPpm: numStr(input.boronPpm),
      textureClass: input.textureClass,
      clayPct: numStr(input.clayPct),
      sandPct: numStr(input.sandPct),
      siltPct: numStr(input.siltPct),
      bulkDensityGPerCm3: numStr(input.bulkDensityGPerCm3),
      infiltrationRateCmPerHr: numStr(input.infiltrationRateCmPerHr),
      carbonatePct: numStr(input.carbonatePct),
      salinityClass: input.salinityClass,
      sodicityClass: input.sodicityClass,
      aiSummary: input.aiSummary,
      aiSummaryUr: input.aiSummaryUr,
      fullReportUrl: input.fullReportUrl,
    })
    .returning({ id: soilHealthCards.id });

  revalidatePath(`/fields/${input.fieldId}/soil`);
  return row;
}

/**
 * Generate a grid of GPS sample points inside a bounding box. Used by the
 * sampling planner UI. Bbox is [minLng, minLat, maxLng, maxLat]. Returns
 * `count` points roughly evenly distributed.
 */
export function generateGpsGrid(
  bbox: [number, number, number, number],
  count: number,
): Array<{ lat: number; lng: number; label: string }> {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const side = Math.max(1, Math.ceil(Math.sqrt(count)));
  const out: Array<{ lat: number; lng: number; label: string }> = [];
  let n = 1;
  for (let i = 0; i < side && out.length < count; i += 1) {
    for (let j = 0; j < side && out.length < count; j += 1) {
      const lng = minLng + ((j + 0.5) / side) * (maxLng - minLng);
      const lat = minLat + ((i + 0.5) / side) * (maxLat - minLat);
      out.push({ lat, lng, label: `S${n}` });
      n += 1;
    }
  }
  return out;
}
