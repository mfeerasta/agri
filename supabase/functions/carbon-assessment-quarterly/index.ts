// carbon-assessment-quarterly
// Schedule: pg_cron quarterly (e.g. 06:00 PKT on the 1st of Jan/Apr/Jul/Oct).
// For each entity, computes a carbon footprint for the past 90 days and
// inserts a row into zameen.carbon_assessments. No Sentinel/external services.

import { getServiceClient, jsonResponse } from '../_shared/supabase.ts';
import { instrument } from '../_shared/instrumented.ts';

interface EntityRow {
  id: string;
}

const FACTORS = {
  dieselCombustionKgPerLiter: 2.68,
  gridElectricityKgPerKwh: 0.45,
  entericCattleKgYear: 89,
  entericBuffaloKgYear: 110,
  entericGoatKgYear: 9,
  entericSheepKgYear: 8,
  gwpCh4: 25,
  gwpN2o: 298,
  riceFloodedCh4KgPerAcreSeason: 540,
  riceAwdReductionFactor: 0.48,
  fertilizerKgNPerKgUrea: 0.46,
  fertilizerN2oFractionKgPerKgN: 0.01,
  soilCarbonNoTillTcPerAcreYear: 0.18,
  soilCarbonCoverTcPerAcreYear: 0.14,
  soilCarbonBiocharTcPerAcreYear: 0.95,
  agroforestryTco2ePerTreeYear: 0.022,
  cToCo2e: 3.667,
};

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

Deno.serve(instrument('carbon-assessment-quarterly', async () => {
  const supabase = getServiceClient();
  const today = new Date();
  const ninetyAgo = new Date(today.getTime() - 90 * 86400_000);
  const fromDate = isoDay(ninetyAgo);
  const toDate = isoDay(today);
  const fraction = 90 / 365.25;

  const { data: entities } = await supabase.schema('zameen').from('entities').select('id');
  let inserted = 0;
  for (const e of ((entities ?? []) as EntityRow[])) {
    const entityId = e.id;

    const { data: diesel } = await supabase
      .schema('zameen')
      .from('diesel_daily_logs')
      .select('quantity_liters')
      .eq('entity_id', entityId)
      .gte('log_date', fromDate)
      .lte('log_date', toDate);
    const dieselLiters = (diesel ?? []).reduce((s, r) => s + Number(r.quantity_liters ?? 0), 0);
    const dieselCo2e = (dieselLiters * FACTORS.dieselCombustionKgPerLiter) / 1000;

    const { data: animals } = await supabase
      .schema('zameen')
      .from('animals')
      .select('species,status')
      .eq('entity_id', entityId)
      .eq('status', 'active');
    let entericKg = 0;
    for (const a of animals ?? []) {
      switch (a.species) {
        case 'cattle': entericKg += FACTORS.entericCattleKgYear; break;
        case 'buffalo': entericKg += FACTORS.entericBuffaloKgYear; break;
        case 'goat': entericKg += FACTORS.entericGoatKgYear; break;
        case 'sheep': entericKg += FACTORS.entericSheepKgYear; break;
        default: entericKg += FACTORS.entericGoatKgYear;
      }
    }
    const entericCo2e = (entericKg * fraction * FACTORS.gwpCh4) / 1000;

    const { data: practices } = await supabase
      .schema('zameen')
      .from('sustainability_practices')
      .select('practice_kind,area_acres,is_active')
      .eq('entity_id', entityId)
      .eq('is_active', true);
    let awdAcres = 0;
    let soilCTons = 0;
    let biocharTco2e = 0;
    let agroforestryTco2e = 0;
    for (const p of practices ?? []) {
      const acres = Number(p.area_acres ?? 0);
      switch (p.practice_kind) {
        case 'rice_alternate_wetting_drying': awdAcres += acres; break;
        case 'no_till':
        case 'reduced_till':
          soilCTons += acres * FACTORS.soilCarbonNoTillTcPerAcreYear * fraction;
          break;
        case 'cover_cropping':
        case 'mulching':
          soilCTons += acres * FACTORS.soilCarbonCoverTcPerAcreYear * fraction;
          break;
        case 'biochar_application':
          biocharTco2e += acres * FACTORS.soilCarbonBiocharTcPerAcreYear * FACTORS.cToCo2e * fraction;
          break;
        case 'agroforestry':
        case 'windbreak_planting':
          agroforestryTco2e += acres * 40 * FACTORS.agroforestryTco2ePerTreeYear * fraction;
          break;
      }
    }
    const soilCo2e = soilCTons * FACTORS.cToCo2e;

    // Rice acreage via crop_plans + fields join.
    const { data: rice } = await supabase
      .schema('zameen')
      .from('crop_plans')
      .select('field_id,crop_name')
      .eq('entity_id', entityId)
      .ilike('crop_name', '%rice%');
    let riceAcres = 0;
    if (rice && rice.length > 0) {
      const fieldIds = rice.map((r) => r.field_id).filter(Boolean);
      if (fieldIds.length > 0) {
        const { data: fld } = await supabase
          .schema('zameen')
          .from('fields')
          .select('acres')
          .in('id', fieldIds);
        riceAcres = (fld ?? []).reduce((s, r) => s + Number(r.acres ?? 0), 0);
      }
    }
    const awdEff = Math.min(awdAcres, riceAcres);
    const flooded = Math.max(0, riceAcres - awdEff);
    const riceCh4 = flooded * FACTORS.riceFloodedCh4KgPerAcreSeason
      + awdEff * FACTORS.riceFloodedCh4KgPerAcreSeason * (1 - FACTORS.riceAwdReductionFactor);
    const riceCo2e = (riceCh4 * FACTORS.gwpCh4) / 1000;
    const manureCo2e = entericCo2e * 0.05;

    // Fertilizer issuance window.
    const { data: ferts } = await supabase
      .schema('zameen')
      .from('input_issuances')
      .select('quantity,input_id,issued_on')
      .eq('entity_id', entityId)
      .gte('issued_on', fromDate)
      .lte('issued_on', toDate);
    let fertKg = 0;
    if (ferts && ferts.length > 0) {
      const inputIds = [...new Set(ferts.map((f) => f.input_id))];
      const { data: inputDefs } = await supabase
        .schema('zameen')
        .from('inputs')
        .select('id,type')
        .in('id', inputIds);
      const fertIds = new Set((inputDefs ?? []).filter((i) => i.type === 'fertilizer').map((i) => i.id));
      fertKg = ferts.filter((f) => fertIds.has(f.input_id)).reduce((s, f) => s + Number(f.quantity ?? 0), 0);
    }
    const nKg = fertKg * FACTORS.fertilizerKgNPerKgUrea;
    const fertN2oCo2e = (nKg * FACTORS.fertilizerN2oFractionKgPerKgN * FACTORS.gwpN2o) / 1000;

    const scopeCo2eTons = {
      scope1: {
        dieselCombustion: round3(dieselCo2e),
        entericMethane: round3(entericCo2e),
        riceMethane: round3(riceCo2e),
        manureManagement: round3(manureCo2e),
      },
      scope2: { gridElectricity: 0 },
      scope3: { fertilizerN2o: round3(fertN2oCo2e), inputTransport: 0 },
      sequestration: {
        soilCarbon: round3(soilCo2e),
        agroforestry: round3(agroforestryTco2e),
        biochar: round3(biocharTco2e),
      },
    };
    const emissions = dieselCo2e + entericCo2e + riceCo2e + manureCo2e + fertN2oCo2e;
    const sequestration = soilCo2e + agroforestryTco2e + biocharTco2e;
    const net = emissions - sequestration;

    const { error } = await supabase.schema('zameen').from('carbon_assessments').insert({
      entity_id: entityId,
      assessment_date: toDate,
      scope_co2e_tons: scopeCo2eTons,
      total_emissions_co2e_tons: round3(emissions),
      total_sequestration_co2e_tons: round3(sequestration),
      net_co2e_tons: round3(net),
      methodology: 'Auto cron (IPCC tier-1 + farm activity data, 90d window)',
    });
    if (!error) inserted += 1;
  }

  return jsonResponse({ ok: true, inserted, fromDate, toDate });
}));

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
