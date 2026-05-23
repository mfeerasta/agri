import { and, between, eq, sql } from 'drizzle-orm';
import {
  db,
  dieselDailyLogs,
  animals,
  fields,
  cropPlans,
  inputIssuances,
  inputs,
  sustainabilityPractices,
} from '@zameen/db';
import { CARBON_FACTORS } from '@zameen/shared';

export interface ScopeBreakdown {
  scope1: {
    dieselCombustion: number;
    entericMethane: number;
    riceMethane: number;
    manureManagement: number;
  };
  scope2: {
    gridElectricity: number;
  };
  scope3: {
    fertilizerN2o: number;
    inputTransport: number;
  };
  sequestration: {
    soilCarbon: number;
    agroforestry: number;
    biochar: number;
  };
}

export interface CarbonFootprintResult {
  entityId: string;
  fromDate: string;
  toDate: string;
  scopeCo2eTons: ScopeBreakdown;
  totalEmissionsCo2eTons: number;
  totalSequestrationCo2eTons: number;
  netCo2eTons: number;
  notes: string[];
}

interface ComputeInput {
  entityId: string;
  fromDate: string; // ISO date YYYY-MM-DD
  toDate: string;
  estimatedTubewellKwh?: number;
  estimatedInputTransportTonKm?: number;
}

function num(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function yearFraction(fromDate: string, toDate: string): number {
  const from = new Date(fromDate).getTime();
  const to = new Date(toDate).getTime();
  const ms = Math.max(0, to - from);
  return ms / (365.25 * 24 * 3600 * 1000);
}

export async function computeCarbonFootprint(input: ComputeInput): Promise<CarbonFootprintResult> {
  const { entityId, fromDate, toDate } = input;
  const notes: string[] = [];

  // Scope 1a: diesel combustion via daily logs (sum of liters issued).
  const dieselRows = await db
    .select({ liters: sql<number>`coalesce(sum(${dieselDailyLogs.quantityLiters})::numeric, 0)` })
    .from(dieselDailyLogs)
    .where(
      and(
        eq(dieselDailyLogs.entityId, entityId),
        between(dieselDailyLogs.logDate, fromDate, toDate),
      ),
    );
  const dieselLiters = num(dieselRows[0]?.liters);
  const dieselCo2eTons = (dieselLiters * CARBON_FACTORS.dieselCombustionKgPerLiter) / 1000;

  // Scope 1b: enteric methane from active livestock, scaled to period length.
  const fraction = Math.max(0, Math.min(1, yearFraction(fromDate, toDate)));
  const animalCounts = await db
    .select({ species: animals.species, count: sql<number>`count(*)::int` })
    .from(animals)
    .where(and(eq(animals.entityId, entityId), eq(animals.status, 'active')))
    .groupBy(animals.species);

  let entericKg = 0;
  for (const row of animalCounts) {
    const c = num(row.count);
    switch (row.species) {
      case 'cattle':
        entericKg += c * CARBON_FACTORS.entericCh4KgPerCattleYear;
        break;
      case 'buffalo':
        entericKg += c * CARBON_FACTORS.entericCh4KgPerBuffaloYear;
        break;
      case 'goat':
        entericKg += c * CARBON_FACTORS.entericCh4KgPerGoatYear;
        break;
      case 'sheep':
        entericKg += c * CARBON_FACTORS.entericCh4KgPerSheepYear;
        break;
      default:
        entericKg += c * CARBON_FACTORS.entericCh4KgPerGoatYear;
    }
  }
  const entericCo2eTons = (entericKg * fraction * CARBON_FACTORS.gwpCh4) / 1000;

  // Scope 1c: rice methane. Rice crop plans active in window.
  const riceRows = await db
    .select({
      acres: sql<number>`coalesce(sum(${fields.acres})::numeric, 0)`,
    })
    .from(cropPlans)
    .innerJoin(fields, eq(cropPlans.fieldId, fields.id))
    .where(
      and(
        eq(cropPlans.entityId, entityId),
        sql`lower(${cropPlans.cropName}) like '%rice%'`,
      ),
    )
    .catch(() => [] as Array<{ acres: number }>);
  const riceAcres = num(riceRows[0]?.acres);

  // Check for AWD practice mitigation.
  const awdRows = await db
    .select({ acres: sql<number>`coalesce(sum(${sustainabilityPractices.areaAcres})::numeric, 0)` })
    .from(sustainabilityPractices)
    .where(
      and(
        eq(sustainabilityPractices.entityId, entityId),
        eq(sustainabilityPractices.practiceKind, 'rice_alternate_wetting_drying'),
        eq(sustainabilityPractices.isActive, true),
      ),
    );
  const awdAcres = Math.min(num(awdRows[0]?.acres), riceAcres);
  const floodedAcres = Math.max(0, riceAcres - awdAcres);
  const riceCh4Kg =
    floodedAcres * CARBON_FACTORS.riceFloodedCh4KgPerAcreSeason +
    awdAcres * CARBON_FACTORS.riceFloodedCh4KgPerAcreSeason * (1 - CARBON_FACTORS.riceAwdReductionFactor);
  const riceCo2eTons = (riceCh4Kg * CARBON_FACTORS.gwpCh4) / 1000;

  // Scope 1d: manure management — proxy at 5% of enteric for cattle/buffalo.
  const manureCo2eTons = entericCo2eTons * 0.05;

  // Scope 2: grid electricity (tubewells). Caller passes estimate; default 0.
  const kwh = input.estimatedTubewellKwh ?? 0;
  if (kwh === 0) notes.push('No tubewell kWh provided; Scope 2 electricity set to zero.');
  const gridCo2eTons = (kwh * CARBON_FACTORS.gridElectricityKgPerKwh) / 1000;

  // Scope 3a: fertilizer N2O. Sum urea-equivalent N issued in window.
  const fertRows = await db
    .select({
      qty: sql<number>`coalesce(sum(${inputIssuances.quantity})::numeric, 0)`,
    })
    .from(inputIssuances)
    .innerJoin(inputs, eq(inputIssuances.inputId, inputs.id))
    .where(
      and(
        eq(inputIssuances.entityId, entityId),
        eq(inputs.type, 'fertilizer'),
        between(inputIssuances.issuedOn, new Date(fromDate), new Date(toDate)),
      ),
    );
  const fertKg = num(fertRows[0]?.qty);
  const nKg = fertKg * CARBON_FACTORS.fertilizerKgNPerKgUrea;
  const n2oKg = nKg * CARBON_FACTORS.syntheticNFertilizerN2oFractionKgPerKgN;
  const fertN2oCo2eTons = (n2oKg * CARBON_FACTORS.gwpN2o) / 1000;

  // Scope 3b: input transport.
  const tonKm = input.estimatedInputTransportTonKm ?? 0;
  const transportCo2eTons = (tonKm * CARBON_FACTORS.transportKgCo2ePerTonKm) / 1000;

  // Sequestration: practice-driven.
  const practices = await db
    .select({
      kind: sustainabilityPractices.practiceKind,
      acres: sql<number>`coalesce(${sustainabilityPractices.areaAcres}::numeric, 0)`,
    })
    .from(sustainabilityPractices)
    .where(
      and(
        eq(sustainabilityPractices.entityId, entityId),
        eq(sustainabilityPractices.isActive, true),
      ),
    );

  let soilCTons = 0;
  let biocharTco2e = 0;
  let agroforestryTco2e = 0;
  for (const p of practices) {
    const a = num(p.acres);
    if (p.kind === 'no_till' || p.kind === 'reduced_till') {
      soilCTons += a * CARBON_FACTORS.soilCarbonTcPerAcreYearNoTill * fraction;
    } else if (p.kind === 'cover_cropping' || p.kind === 'mulching') {
      soilCTons += a * CARBON_FACTORS.soilCarbonTcPerAcreYearCoverCrop * fraction;
    } else if (p.kind === 'biochar_application') {
      biocharTco2e += a * CARBON_FACTORS.soilCarbonTcPerAcreYearBiochar * CARBON_FACTORS.cToCo2eFactor * fraction;
    } else if (p.kind === 'agroforestry' || p.kind === 'windbreak_planting') {
      // Treat acres as proxy: ~40 trees/acre.
      agroforestryTco2e += a * 40 * CARBON_FACTORS.agroforestryTco2ePerTreeYear * fraction;
    }
  }
  const soilCo2eTons = soilCTons * CARBON_FACTORS.cToCo2eFactor;

  const scopeCo2eTons: ScopeBreakdown = {
    scope1: {
      dieselCombustion: round3(dieselCo2eTons),
      entericMethane: round3(entericCo2eTons),
      riceMethane: round3(riceCo2eTons),
      manureManagement: round3(manureCo2eTons),
    },
    scope2: {
      gridElectricity: round3(gridCo2eTons),
    },
    scope3: {
      fertilizerN2o: round3(fertN2oCo2eTons),
      inputTransport: round3(transportCo2eTons),
    },
    sequestration: {
      soilCarbon: round3(soilCo2eTons),
      agroforestry: round3(agroforestryTco2e),
      biochar: round3(biocharTco2e),
    },
  };

  const totalEmissionsCo2eTons = round3(
    dieselCo2eTons +
      entericCo2eTons +
      riceCo2eTons +
      manureCo2eTons +
      gridCo2eTons +
      fertN2oCo2eTons +
      transportCo2eTons,
  );
  const totalSequestrationCo2eTons = round3(soilCo2eTons + agroforestryTco2e + biocharTco2e);
  const netCo2eTons = round3(totalEmissionsCo2eTons - totalSequestrationCo2eTons);

  return {
    entityId,
    fromDate,
    toDate,
    scopeCo2eTons,
    totalEmissionsCo2eTons,
    totalSequestrationCo2eTons,
    netCo2eTons,
    notes,
  };
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export function sustainabilityScore(footprint: CarbonFootprintResult): number {
  // 0 to 100, weighted toward sequestration share and net trend.
  if (footprint.totalEmissionsCo2eTons <= 0) return 100;
  const seqShare = footprint.totalSequestrationCo2eTons / footprint.totalEmissionsCo2eTons;
  const raw = Math.min(1, seqShare) * 80;
  const netBonus = footprint.netCo2eTons < 0 ? 20 : Math.max(0, 20 - footprint.netCo2eTons / 10);
  return Math.round(Math.max(0, Math.min(100, raw + netBonus)));
}
