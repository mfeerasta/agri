import { eq, sql as dsql } from 'drizzle-orm';
import { db, sql } from './index.js';
import {
  entities,
  entitySettings,
  cropProfiles,
  accounts,
  approvalWorkflows,
  users,
  userEntityRoles,
  workers,
  farms,
  blocks,
  fields,
  cropPlans,
  assets,
  fuelStorageTanks,
  vendors,
  buyers,
  arhtis,
} from './schema/index.js';

const DEFAULT_THRESHOLDS = {
  feasibility_study: { supervisor: 0, farm_manager: 0, director: 0 },
  input_purchase: { supervisor: 25_000, farm_manager: 100_000, director: null },
  diesel_purchase: { supervisor: 25_000, farm_manager: 50_000, director: null },
  repair: { supervisor: 10_000, farm_manager: 50_000, director: null },
  asset_purchase: { supervisor: 0, farm_manager: 0, director: null },
  livestock_purchase: { supervisor: 0, farm_manager: 0, director: null },
  livestock_sale: { supervisor: 0, farm_manager: 0, director: null },
  crop_sale: { supervisor: 0, farm_manager: 500_000, director: null },
  labor_hire: { supervisor: 0, farm_manager: 0, director: null },
  lease: { supervisor: 0, farm_manager: 0, director: 0 },
  capex: { supervisor: 0, farm_manager: 0, director: null },
  land_transaction: { supervisor: 0, farm_manager: 0, director: 0 },
  tax_payment: { supervisor: 0, farm_manager: 0, director: null },
  loan: { supervisor: 0, farm_manager: 0, director: 0 },
};

interface StageEntry {
  stage: string;
  dayOffset: number;
  taskKind: string;
  title: string;
  titleUr?: string;
  estimatedHours?: number;
}

function timeline(entries: StageEntry[]): StageEntry[] {
  return entries;
}

const CROP_LIBRARY = [
  {
    code: 'wheat',
    name: 'Wheat',
    nameUr: 'گندم',
    season: 'rabi' as const,
    growthDurationDays: 145,
    yieldBenchmarkPerAcre: '32',
    yieldUnit: 'mann',
    stageTimeline: timeline([
      { stage: 'land_prep', dayOffset: -10, taskKind: 'land_prep', title: 'Plough and laser-level' },
      { stage: 'sowing', dayOffset: 0, taskKind: 'sowing', title: 'Drill seed', titleUr: 'بیج بونا' },
      { stage: 'germination', dayOffset: 8, taskKind: 'irrigation', title: 'First irrigation (rauni)' },
      { stage: 'vegetative', dayOffset: 25, taskKind: 'fertilizer', title: 'Apply urea top-dress' },
      { stage: 'flowering', dayOffset: 75, taskKind: 'pesticide', title: 'Aphid scout and spray' },
      { stage: 'maturity', dayOffset: 130, taskKind: 'pre_harvest', title: 'Dry-down check' },
      { stage: 'harvest', dayOffset: 145, taskKind: 'harvest', title: 'Combine harvest' },
    ]),
    recommendedInputs: [{ input: 'DAP', kgPerAcre: 50 }, { input: 'Urea', kgPerAcre: 100 }],
  },
  {
    code: 'maize',
    name: 'Maize (Pioneer hybrid)',
    nameUr: 'مکئی',
    season: 'kharif' as const,
    growthDurationDays: 110,
    yieldBenchmarkPerAcre: '70',
    yieldUnit: 'mann',
    stageTimeline: timeline([
      { stage: 'sowing', dayOffset: 0, taskKind: 'sowing', title: 'Sow maize' },
      { stage: 'vegetative', dayOffset: 20, taskKind: 'fertilizer', title: 'Apply NPK basal' },
      { stage: 'flowering', dayOffset: 60, taskKind: 'irrigation', title: 'Tassel-stage irrigation' },
      { stage: 'harvest', dayOffset: 110, taskKind: 'harvest', title: 'Harvest cobs' },
    ]),
    recommendedInputs: [{ input: 'DAP', kgPerAcre: 60 }, { input: 'Urea', kgPerAcre: 110 }],
  },
  {
    code: 'rice-basmati-386',
    name: 'Rice Basmati 386',
    nameUr: 'باسمتی چاول',
    season: 'kharif' as const,
    growthDurationDays: 140,
    yieldBenchmarkPerAcre: '42',
    yieldUnit: 'mann',
    stageTimeline: timeline([
      { stage: 'land_prep', dayOffset: -15, taskKind: 'land_prep', title: 'Puddle and level' },
      { stage: 'sowing', dayOffset: 0, taskKind: 'transplant', title: 'Transplant seedlings' },
      { stage: 'harvest', dayOffset: 140, taskKind: 'harvest', title: 'Harvest paddy' },
    ]),
    recommendedInputs: [{ input: 'DAP', kgPerAcre: 50 }, { input: 'Urea', kgPerAcre: 90 }],
  },
  {
    code: 'rice-irri-6',
    name: 'Rice IRRI-6',
    nameUr: 'ارّی-۶ چاول',
    season: 'kharif' as const,
    growthDurationDays: 125,
    yieldBenchmarkPerAcre: '55',
    yieldUnit: 'mann',
    stageTimeline: timeline([
      { stage: 'sowing', dayOffset: 0, taskKind: 'transplant', title: 'Transplant IRRI-6' },
      { stage: 'harvest', dayOffset: 125, taskKind: 'harvest', title: 'Harvest paddy' },
    ]),
    recommendedInputs: [],
  },
  {
    code: 'cotton-fh-142',
    name: 'Cotton FH-142',
    nameUr: 'کپاس ایف ایچ ۱۴۲',
    season: 'kharif' as const,
    growthDurationDays: 180,
    yieldBenchmarkPerAcre: '28',
    yieldUnit: 'mann',
    stageTimeline: timeline([
      { stage: 'sowing', dayOffset: 0, taskKind: 'sowing', title: 'Sow cotton' },
      { stage: 'flowering', dayOffset: 70, taskKind: 'pesticide', title: 'Bollworm spray' },
      { stage: 'harvest', dayOffset: 180, taskKind: 'harvest', title: 'First picking' },
    ]),
    recommendedInputs: [],
  },
  {
    code: 'cotton-mnh-886',
    name: 'Cotton MNH-886',
    nameUr: 'کپاس ایم این ایچ ۸۸۶',
    season: 'kharif' as const,
    growthDurationDays: 175,
    yieldBenchmarkPerAcre: '30',
    yieldUnit: 'mann',
    stageTimeline: timeline([{ stage: 'sowing', dayOffset: 0, taskKind: 'sowing', title: 'Sow cotton MNH' }]),
    recommendedInputs: [],
  },
  {
    code: 'sugarcane-hsf-240',
    name: 'Sugarcane HSF-240',
    nameUr: 'گنا ایچ ایس ایف ۲۴۰',
    season: 'perennial' as const,
    growthDurationDays: 365,
    yieldBenchmarkPerAcre: '900',
    yieldUnit: 'mann',
    stageTimeline: timeline([{ stage: 'sowing', dayOffset: 0, taskKind: 'planting', title: 'Plant setts' }]),
    recommendedInputs: [],
  },
  {
    code: 'sugarcane-cpf-247',
    name: 'Sugarcane CPF-247',
    nameUr: 'گنا سی پی ایف ۲۴۷',
    season: 'perennial' as const,
    growthDurationDays: 360,
    yieldBenchmarkPerAcre: '850',
    yieldUnit: 'mann',
    stageTimeline: timeline([{ stage: 'sowing', dayOffset: 0, taskKind: 'planting', title: 'Plant setts' }]),
    recommendedInputs: [],
  },
  {
    code: 'fodder-maize',
    name: 'Fodder Maize',
    nameUr: 'چارہ مکئی',
    season: 'kharif' as const,
    growthDurationDays: 70,
    yieldBenchmarkPerAcre: '300',
    yieldUnit: 'mann',
    stageTimeline: timeline([{ stage: 'harvest', dayOffset: 70, taskKind: 'harvest', title: 'Cut fodder' }]),
    recommendedInputs: [],
  },
  {
    code: 'berseem',
    name: 'Berseem',
    nameUr: 'برسیم',
    season: 'rabi' as const,
    growthDurationDays: 180,
    yieldBenchmarkPerAcre: '500',
    yieldUnit: 'mann',
    stageTimeline: timeline([
      { stage: 'sowing', dayOffset: 0, taskKind: 'sowing', title: 'Sow berseem' },
      { stage: 'harvest', dayOffset: 60, taskKind: 'harvest', title: 'First cut' },
    ]),
    recommendedInputs: [],
  },
  { code: 'gram', name: 'Gram (Chana)', nameUr: 'چنا', season: 'rabi' as const, growthDurationDays: 150, yieldBenchmarkPerAcre: '14', yieldUnit: 'mann', stageTimeline: [], recommendedInputs: [] },
  { code: 'mustard', name: 'Mustard', nameUr: 'سرسوں', season: 'rabi' as const, growthDurationDays: 130, yieldBenchmarkPerAcre: '12', yieldUnit: 'mann', stageTimeline: [{ stage: 'sowing', dayOffset: 0, taskKind: 'sowing', title: 'Sow mustard' }], recommendedInputs: [] },
  { code: 'mash', name: 'Mash (Black gram)', nameUr: 'ماش', season: 'kharif' as const, growthDurationDays: 90, yieldBenchmarkPerAcre: '10', yieldUnit: 'mann', stageTimeline: [], recommendedInputs: [] },
  { code: 'canola', name: 'Canola', nameUr: 'کینولا', season: 'rabi' as const, growthDurationDays: 140, yieldBenchmarkPerAcre: '18', yieldUnit: 'mann', stageTimeline: [], recommendedInputs: [] },
  { code: 'sunflower', name: 'Sunflower', nameUr: 'سورج مکھی', season: 'zaid' as const, growthDurationDays: 100, yieldBenchmarkPerAcre: '20', yieldUnit: 'mann', stageTimeline: [], recommendedInputs: [] },
  { code: 'potato', name: 'Potato', nameUr: 'آلو', season: 'rabi' as const, growthDurationDays: 110, yieldBenchmarkPerAcre: '250', yieldUnit: 'mann', stageTimeline: [], recommendedInputs: [] },
  { code: 'onion', name: 'Onion', nameUr: 'پیاز', season: 'rabi' as const, growthDurationDays: 130, yieldBenchmarkPerAcre: '180', yieldUnit: 'mann', stageTimeline: [], recommendedInputs: [] },
  { code: 'garlic', name: 'Garlic', nameUr: 'لہسن', season: 'rabi' as const, growthDurationDays: 160, yieldBenchmarkPerAcre: '60', yieldUnit: 'mann', stageTimeline: [], recommendedInputs: [] },
  { code: 'jowar-fodder', name: 'Jowar Fodder', nameUr: 'جوار چارہ', season: 'kharif' as const, growthDurationDays: 75, yieldBenchmarkPerAcre: '280', yieldUnit: 'mann', stageTimeline: [], recommendedInputs: [] },
];

const STANDARD_COA = [
  { code: '1000', name: 'Cash on Hand', accountType: 'asset' },
  { code: '1010', name: 'Bank - Soneri Current', accountType: 'asset' },
  { code: '1100', name: 'Accounts Receivable', accountType: 'asset' },
  { code: '1200', name: 'Input Inventory', accountType: 'asset' },
  { code: '1210', name: 'Produce Inventory', accountType: 'asset' },
  { code: '1220', name: 'Diesel Stock', accountType: 'asset' },
  { code: '1500', name: 'Tractors and Equipment', accountType: 'asset' },
  { code: '1510', name: 'Accumulated Depreciation', accountType: 'asset' },
  { code: '1600', name: 'Land', accountType: 'asset' },
  { code: '2000', name: 'Accounts Payable', accountType: 'liability' },
  { code: '2100', name: 'Loans Payable', accountType: 'liability' },
  { code: '3000', name: 'Owner Equity', accountType: 'equity' },
  { code: '3100', name: 'Retained Earnings', accountType: 'equity' },
  { code: '4000', name: 'Crop Sales', accountType: 'revenue' },
  { code: '4100', name: 'Milk Sales', accountType: 'revenue' },
  { code: '4200', name: 'Livestock Sales', accountType: 'revenue' },
  { code: '4900', name: 'Other Income', accountType: 'revenue' },
  { code: '5000', name: 'Seed Cost', accountType: 'expense', costPool: 'seed' },
  { code: '5010', name: 'Fertilizer Cost', accountType: 'expense', costPool: 'fertilizer' },
  { code: '5020', name: 'Pesticide Cost', accountType: 'expense', costPool: 'pesticide' },
  { code: '5030', name: 'Diesel Cost', accountType: 'expense', costPool: 'diesel' },
  { code: '5040', name: 'Labor - Field', accountType: 'expense', costPool: 'labor_field' },
  { code: '5050', name: 'Labor - Livestock', accountType: 'expense', costPool: 'labor_livestock' },
  { code: '5060', name: 'Repairs and Maintenance', accountType: 'expense', costPool: 'repairs' },
  { code: '5070', name: 'Tubewell Electricity', accountType: 'expense', costPool: 'irrigation' },
  { code: '5080', name: 'Land Rent', accountType: 'expense', costPool: 'land_rent' },
  { code: '5090', name: 'Veterinary and Medicine', accountType: 'expense', costPool: 'vet' },
  { code: '5100', name: 'Feed and Forage', accountType: 'expense', costPool: 'feed' },
  { code: '5200', name: 'Freight and Transport', accountType: 'expense', costPool: 'freight' },
  { code: '5300', name: 'Mandi Commission and Loading', accountType: 'expense', costPool: 'mandi_charges' },
  { code: '5400', name: 'Office and Admin', accountType: 'expense', costPool: 'admin' },
  { code: '5500', name: 'Depreciation', accountType: 'expense', costPool: 'depreciation' },
  { code: '5600', name: 'Bank Charges and Interest', accountType: 'expense', costPool: 'finance_charges' },
  { code: '5700', name: 'Taxes - Agri and Lagaan', accountType: 'expense', costPool: 'tax' },
];

const AUTH_USERS = [
  { id: '11111111-1111-1111-1111-111111111111', fullName: 'Meer Feerasta', fullNameUr: 'میر فراست', primaryRole: 'director' as const, phone: '+923000000001', email: 'meerfeerasta@gmail.com' },
  { id: '22222222-2222-2222-2222-222222222222', fullName: 'Farm Manager 1', fullNameUr: 'فارم منیجر ۱', primaryRole: 'farm_manager' as const, phone: '+923000000002' },
  { id: '33333333-3333-3333-3333-333333333333', fullName: 'Supervisor Raiwind 1', fullNameUr: 'سپروائزر رائے ونڈ ۱', primaryRole: 'supervisor' as const, phone: '+923000000003' },
  { id: '44444444-4444-4444-4444-444444444444', fullName: 'Supervisor Raiwind 2', fullNameUr: 'سپروائزر رائے ونڈ ۲', primaryRole: 'supervisor' as const, phone: '+923000000004' },
];

const SAMPLE_WORKERS = [
  { code: 'W001', fullName: 'Allah Ditta', fullNameUr: 'اللہ دتا', cnicLast4: '4321', dailyWagePkr: '1200' },
  { code: 'W002', fullName: 'Muhammad Akram', fullNameUr: 'محمد اکرم', cnicLast4: '8765', dailyWagePkr: '1200' },
  { code: 'W003', fullName: 'Ghulam Rasool', fullNameUr: 'غلام رسول', cnicLast4: '2210', dailyWagePkr: '1300' },
  { code: 'W004', fullName: 'Rana Sharif', fullNameUr: 'رانا شریف', cnicLast4: '5544', monthlySalaryPkr: '38000' },
  { code: 'W005', fullName: 'Bashir Ahmad', fullNameUr: 'بشیر احمد', cnicLast4: '9912', dailyWagePkr: '1200' },
  { code: 'W006', fullName: 'Imran Sandhu', fullNameUr: 'عمران سندھو', cnicLast4: '7788', dailyWagePkr: '1400' },
  { code: 'W007', fullName: 'Liaqat Cheema', fullNameUr: 'لیاقت چیمہ', cnicLast4: '3344', dailyWagePkr: '1100' },
  { code: 'W008', fullName: 'Saeed Akhtar', fullNameUr: 'سعید اختر', cnicLast4: '6677', dailyWagePkr: '1100' },
  { code: 'W009', fullName: 'Manzoor Hussain', fullNameUr: 'منظور حسین', cnicLast4: '1188', dailyWagePkr: '1200' },
  { code: 'W010', fullName: 'Tariq Mehmood', fullNameUr: 'طارق محمود', cnicLast4: '5050', dailyWagePkr: '1300' },
];

// Build a small square polygon roughly centered at Raiwind (31.25 N, 74.15 E).
function squarePolygon(originLat: number, originLng: number, sideDeg: number) {
  const ring = [
    [originLng, originLat],
    [originLng + sideDeg, originLat],
    [originLng + sideDeg, originLat + sideDeg],
    [originLng, originLat + sideDeg],
    [originLng, originLat],
  ];
  return { type: 'MultiPolygon', coordinates: [[ring]] };
}

async function main() {
  console.log('Seeding crop profiles...');
  for (const c of CROP_LIBRARY) {
    await db.insert(cropProfiles).values(c).onConflictDoNothing();
  }

  console.log('Seeding AGRI entity...');
  await db
    .insert(entities)
    .values({
      code: 'AGRI',
      name: 'Rupafab Agri',
      legalName: 'Rupafab Limited (Agriculture Operation)',
      approvalThresholds: DEFAULT_THRESHOLDS,
    })
    .onConflictDoNothing();
  const [agri] = await db.select().from(entities).where(eq(entities.code, 'AGRI')).limit(1);
  if (!agri) throw new Error('AGRI entity missing');

  await db
    .insert(entitySettings)
    .values({ entityId: agri.id, approvalThresholds: DEFAULT_THRESHOLDS })
    .onConflictDoNothing();

  console.log('Seeding chart of accounts...');
  for (const a of STANDARD_COA) {
    await db.insert(accounts).values({ entityId: agri.id, ...a }).onConflictDoNothing();
  }

  console.log('Seeding 14 approval workflows...');
  for (const [type, thresholds] of Object.entries(DEFAULT_THRESHOLDS)) {
    await db
      .insert(approvalWorkflows)
      .values({ entityId: agri.id, approvalType: type as never, thresholdsPkr: thresholds })
      .onConflictDoNothing();
  }

  console.log('Seeding auth users...');
  for (const u of AUTH_USERS) {
    await db
      .insert(users)
      .values({ ...u, defaultEntityId: agri.id })
      .onConflictDoNothing();
    await db
      .insert(userEntityRoles)
      .values({ userId: u.id, entityId: agri.id, role: u.primaryRole })
      .onConflictDoNothing();
  }

  console.log('Seeding workers...');
  for (const w of SAMPLE_WORKERS) {
    await db
      .insert(workers)
      .values({
        entityId: agri.id,
        code: w.code,
        fullName: w.fullName,
        fullNameUr: w.fullNameUr,
        cnicLast4: w.cnicLast4,
        dailyWagePkr: w.dailyWagePkr ?? null,
        monthlySalaryPkr: w.monthlySalaryPkr ?? null,
        workerType: w.monthlySalaryPkr ? 'permanent' : 'daily_wage',
      })
      .onConflictDoNothing();
  }

  console.log('Seeding farm + blocks + 16 fields...');
  await db
    .insert(farms)
    .values({
      entityId: agri.id,
      code: 'AGRI-RWD',
      name: 'Raiwind Farm',
      district: 'Lahore',
      tehsil: 'Raiwind',
      village: 'Raiwind',
      centroid: { lat: 31.25, lng: 74.15 },
      totalAcres: '100',
    })
    .onConflictDoNothing();
  const [farm] = await db.select().from(farms).where(eq(farms.code, 'AGRI-RWD')).limit(1);
  if (!farm) throw new Error('Farm missing after insert');

  // Block geometry goes through PostGIS after migration 0006. Insert via raw
  // SQL so the GeoJSON shape is converted to geometry(MultiPolygon, 4326).
  {
    const blockGeom = JSON.stringify(squarePolygon(31.25, 74.15, 0.02));
    await db.execute(dsql`
      insert into zameen.blocks (farm_id, code, name, acres, geometry)
      values (${farm.id}, 'B1', 'Block 1', '100', zameen.geom_from_json(${blockGeom}))
      on conflict do nothing
    `);
  }
  const [block] = await db.select().from(blocks).where(eq(blocks.code, 'B1')).limit(1);
  if (!block) throw new Error('Block missing');

  const fieldAcres = [6, 6, 7, 7, 5, 5, 8, 8, 4, 4, 6, 6, 8, 8, 6, 6];
  const totalNeeded = 16;
  const insertedFieldIds: string[] = [];
  for (let i = 0; i < totalNeeded; i += 1) {
    const code = `F${i + 1}`;
    const lat = 31.25 + (i % 4) * 0.005;
    const lng = 74.15 + Math.floor(i / 4) * 0.005;
    const acresStr = String(fieldAcres[i]);
    const geomJson = JSON.stringify(squarePolygon(lat, lng, 0.0045));
    // Raw SQL because fields.geometry is PostGIS geometry(MultiPolygon, 4326)
    // after migration 0006. Drizzle still sees it as jsonb in the schema.
    await db.execute(dsql`
      insert into zameen.fields (block_id, code, acres, geometry)
      values (${block.id}, ${code}, ${acresStr}, zameen.geom_from_json(${geomJson}))
      on conflict do nothing
    `);
    const [f] = await db.select().from(fields).where(eq(fields.code, code)).limit(1);
    if (f) insertedFieldIds.push(f.id);
  }

  console.log('Seeding crop plans (Rabi 2025-26)...');
  const wheatVarieties = ['Akbar 2019', 'Anaj 2017', 'Faisalabad 2008'];
  const cropByIndex: Array<{ profile: string; variety: string | null }> = [
    ...Array.from({ length: 8 }, (_, idx) => ({ profile: 'wheat', variety: wheatVarieties[idx % wheatVarieties.length] })),
    { profile: 'berseem', variety: null }, { profile: 'berseem', variety: null }, { profile: 'berseem', variety: null }, { profile: 'berseem', variety: null },
    { profile: 'mustard', variety: null }, { profile: 'mustard', variety: null },
    { profile: 'fallow', variety: null }, { profile: 'fallow', variety: null },
  ];
  for (let i = 0; i < insertedFieldIds.length; i += 1) {
    const slot = cropByIndex[i];
    if (slot.profile === 'fallow') continue;
    const [profile] = await db.select().from(cropProfiles).where(eq(cropProfiles.code, slot.profile)).limit(1);
    if (!profile) continue;
    await db
      .insert(cropPlans)
      .values({
        fieldId: insertedFieldIds[i],
        cropProfileId: profile.id,
        season: 'rabi',
        seasonLabel: 'Rabi 2025-26',
        varietyName: slot.variety,
        plannedAcres: String(fieldAcres[i]),
        plannedSowingDate: new Date('2025-11-15'),
        plannedHarvestDate: new Date('2026-04-15'),
      })
      .onConflictDoNothing();
  }

  console.log('Seeding assets...');
  const assetRows = [
    { code: 'TR-MF-240', category: 'tractor' as const, make: 'Massey Ferguson', model: '240', year: 2018, currentHourMeter: '4200', manufacturerFuelSpecLph: '5.5' },
    { code: 'TR-MF-385', category: 'tractor' as const, make: 'Massey Ferguson', model: '385', year: 2020, currentHourMeter: '2800', manufacturerFuelSpecLph: '7.0' },
    { code: 'HV-CLAAS', category: 'harvester' as const, make: 'CLAAS', model: 'Crop Tiger', year: 2017, currentHourMeter: '3100', manufacturerFuelSpecLph: '12' },
    { code: 'TW-1', category: 'tubewell' as const, make: 'Honda', model: 'Diesel 12HP', currentHourMeter: '1500' },
    { code: 'TW-2', category: 'tubewell' as const, make: 'Honda', model: 'Diesel 12HP', currentHourMeter: '900' },
    { code: 'GEN-1', category: 'generator' as const, make: 'Perkins', model: '20kVA', currentHourMeter: '600' },
    { code: 'CC-HONDA', category: 'implement' as const, make: 'Honda', model: 'Chaff Cutter', currentHourMeter: '200' },
  ];
  for (const a of assetRows) {
    await db.insert(assets).values({ entityId: agri.id, ...a }).onConflictDoNothing();
  }

  console.log('Seeding fuel storage tank...');
  await db
    .insert(fuelStorageTanks)
    .values({ entityId: agri.id, code: 'MT-1', name: 'Main Tank', capacityLiters: '5000', currentStockLiters: '2500' })
    .onConflictDoNothing();

  console.log('Seeding vendors...');
  const vendorRows = [
    { code: 'V-FFC', name: 'FFC Dealer Raiwind', category: 'fertilizer' },
    { code: 'V-ENGRO', name: 'Engro Dealer Manga Mandi', category: 'fertilizer' },
    { code: 'V-SYNG', name: 'Syngenta Pesticides', category: 'pesticide' },
    { code: 'V-SEED', name: 'Punjab Seed Corp', category: 'seed' },
    { code: 'V-ICI', name: 'ICI Crop Care', category: 'pesticide' },
    { code: 'V-WS-RWD1', name: 'Raiwind Tractor Workshop', category: 'workshop' },
    { code: 'V-WS-MANGA', name: 'Manga Mandi Diesel Mechanics', category: 'workshop' },
    { code: 'V-WS-CLAAS', name: 'CLAAS Authorised Service', category: 'workshop' },
    { code: 'V-PSO-RWD', name: 'PSO Raiwind Pump', category: 'diesel' },
    { code: 'V-SHELL-RWD', name: 'Shell Raiwind Bypass', category: 'diesel' },
  ];
  for (const v of vendorRows) {
    await db.insert(vendors).values({ entityId: agri.id, ...v }).onConflictDoNothing();
  }

  console.log('Seeding buyers and arhtis...');
  await db
    .insert(buyers)
    .values([
      { entityId: agri.id, code: 'B-DAIRY-ENGRO', name: 'Engro Foods Sahiwal Collection', category: 'dairy' },
    ])
    .onConflictDoNothing();
  await db
    .insert(arhtis)
    .values([
      { entityId: agri.id, name: 'Arhti Manga Mandi Wheat', mandiLocation: 'Manga Mandi', commissionPct: '2.5' },
      { entityId: agri.id, name: 'Arhti Lahore Mandi Rice', mandiLocation: 'Lahore Grain Mandi', commissionPct: '2.0' },
    ])
    .onConflictDoNothing();

  console.log('Seed complete.');
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
