/**
 * ISRIC SoilGrids 250m client. Keyless REST API.
 *
 * Endpoint base: https://rest.isric.org/soilgrids/v2.0/
 *
 * SoilGrids encodes values at a scale factor per property. We unscale before
 * returning so callers see real units (pH, g/kg organic carbon, percent clay
 * etc). Provides a sensible baseline soil profile for any farm in Punjab
 * before a real lab test is run.
 */

const SOILGRIDS_BASE = 'https://rest.isric.org/soilgrids/v2.0';
const TIMEOUT_MS = 30_000;

export interface DepthValues {
  '0-5cm': number;
  '5-15cm': number;
  '15-30cm': number;
}

export interface ShallowDepthValues {
  '0-5cm': number;
  '5-15cm': number;
}

export interface SoilGridsResult {
  lat: number;
  lng: number;
  ph: DepthValues;
  organicCarbonGPerKg: DepthValues;
  clayPct: DepthValues;
  sandPct: DepthValues;
  siltPct: DepthValues;
  bulkDensityKgPerDm3: DepthValues;
  cecCmolPerKg: ShallowDepthValues;
  classification: string;
  classifiedConfidence: number;
  fetchedAt: string;
}

// SoilGrids returns scaled integers; unscale factors per property.
const SCALE_FACTORS: Record<string, number> = {
  phh2o: 10, // pH x 10
  soc: 10, // g/kg x 10
  clay: 10, // percent x 10
  sand: 10, // percent x 10
  silt: 10, // percent x 10
  bdod: 100, // cg/cm3 x 100 -> kg/dm3
  cec: 10, // cmol(c)/kg x 10
};

interface SoilGridsDepthLayer {
  range?: { top_depth?: number; bottom_depth?: number };
  label?: string;
  values?: { mean?: number | null };
}

interface SoilGridsProperty {
  name?: string;
  depths?: SoilGridsDepthLayer[];
}

interface SoilGridsPropertiesResponse {
  properties?: { layers?: SoilGridsProperty[] };
}

interface SoilGridsClassificationResponse {
  wrb_class_name?: string;
  wrb_class_probability?: Array<[string, number]>;
}

function timedFetch(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

async function fetchWithRetry(url: string): Promise<Response> {
  try {
    const res = await timedFetch(url);
    if (res.ok) return res;
    throw new Error(`SoilGrids ${res.status}`);
  } catch {
    return timedFetch(url);
  }
}

function depthLabel(layer: SoilGridsDepthLayer): string | null {
  if (layer.label) return layer.label;
  const top = layer.range?.top_depth;
  const bottom = layer.range?.bottom_depth;
  if (typeof top !== 'number' || typeof bottom !== 'number') return null;
  return `${top}-${bottom}cm`;
}

function pickDepth(prop: SoilGridsProperty | undefined, want: string, scale: number): number {
  const layers = prop?.depths ?? [];
  for (const l of layers) {
    if (depthLabel(l) === want) {
      const m = l.values?.mean;
      if (typeof m === 'number') return m / scale;
    }
  }
  return Number.NaN;
}

function pickByName(layers: SoilGridsProperty[], name: string): SoilGridsProperty | undefined {
  return layers.find((p) => p.name === name);
}

export async function fetchSoilGrids({
  lat,
  lng,
}: {
  lat: number;
  lng: number;
}): Promise<SoilGridsResult> {
  const props = ['phh2o', 'soc', 'clay', 'sand', 'silt', 'bdod', 'cec'];
  const depths = ['0-5cm', '5-15cm', '15-30cm'];
  const qs = new URLSearchParams();
  qs.set('lon', String(lng));
  qs.set('lat', String(lat));
  for (const p of props) qs.append('property', p);
  for (const d of depths) qs.append('depth', d);
  qs.append('value', 'mean');

  const propsRes = await fetchWithRetry(`${SOILGRIDS_BASE}/properties/query?${qs.toString()}`);
  const propsJson = (await propsRes.json()) as SoilGridsPropertiesResponse;
  const layers = propsJson.properties?.layers ?? [];

  const ph = pickByName(layers, 'phh2o');
  const soc = pickByName(layers, 'soc');
  const clay = pickByName(layers, 'clay');
  const sand = pickByName(layers, 'sand');
  const silt = pickByName(layers, 'silt');
  const bdod = pickByName(layers, 'bdod');
  const cec = pickByName(layers, 'cec');

  let classification = 'Unknown';
  let classifiedConfidence = 0;
  try {
    const clsRes = await fetchWithRetry(
      `${SOILGRIDS_BASE}/classification/query?lon=${lng}&lat=${lat}&number_classes=1`,
    );
    const clsJson = (await clsRes.json()) as SoilGridsClassificationResponse;
    if (clsJson.wrb_class_name) classification = clsJson.wrb_class_name;
    const top = clsJson.wrb_class_probability?.[0];
    if (top && typeof top[1] === 'number') classifiedConfidence = top[1] / 100;
  } catch {
    // classification is best-effort
  }

  return {
    lat,
    lng,
    ph: {
      '0-5cm': pickDepth(ph, '0-5cm', SCALE_FACTORS.phh2o!),
      '5-15cm': pickDepth(ph, '5-15cm', SCALE_FACTORS.phh2o!),
      '15-30cm': pickDepth(ph, '15-30cm', SCALE_FACTORS.phh2o!),
    },
    organicCarbonGPerKg: {
      '0-5cm': pickDepth(soc, '0-5cm', SCALE_FACTORS.soc!),
      '5-15cm': pickDepth(soc, '5-15cm', SCALE_FACTORS.soc!),
      '15-30cm': pickDepth(soc, '15-30cm', SCALE_FACTORS.soc!),
    },
    clayPct: {
      '0-5cm': pickDepth(clay, '0-5cm', SCALE_FACTORS.clay!),
      '5-15cm': pickDepth(clay, '5-15cm', SCALE_FACTORS.clay!),
      '15-30cm': pickDepth(clay, '15-30cm', SCALE_FACTORS.clay!),
    },
    sandPct: {
      '0-5cm': pickDepth(sand, '0-5cm', SCALE_FACTORS.sand!),
      '5-15cm': pickDepth(sand, '5-15cm', SCALE_FACTORS.sand!),
      '15-30cm': pickDepth(sand, '15-30cm', SCALE_FACTORS.sand!),
    },
    siltPct: {
      '0-5cm': pickDepth(silt, '0-5cm', SCALE_FACTORS.silt!),
      '5-15cm': pickDepth(silt, '5-15cm', SCALE_FACTORS.silt!),
      '15-30cm': pickDepth(silt, '15-30cm', SCALE_FACTORS.silt!),
    },
    bulkDensityKgPerDm3: {
      '0-5cm': pickDepth(bdod, '0-5cm', SCALE_FACTORS.bdod!),
      '5-15cm': pickDepth(bdod, '5-15cm', SCALE_FACTORS.bdod!),
      '15-30cm': pickDepth(bdod, '15-30cm', SCALE_FACTORS.bdod!),
    },
    cecCmolPerKg: {
      '0-5cm': pickDepth(cec, '0-5cm', SCALE_FACTORS.cec!),
      '5-15cm': pickDepth(cec, '5-15cm', SCALE_FACTORS.cec!),
    },
    classification,
    classifiedConfidence,
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * Approximate USDA texture class from sand/clay percentages. Used to populate
 * soil_tests.texture when SoilGrids is the source.
 */
export function classifyTexture(sandPct: number, clayPct: number): string {
  const silt = Math.max(0, 100 - sandPct - clayPct);
  if (clayPct >= 40) return 'clay';
  if (clayPct >= 27 && sandPct <= 45) return 'clay loam';
  if (sandPct >= 70 && clayPct < 15) return 'sandy loam';
  if (sandPct >= 85) return 'sand';
  if (silt >= 50 && clayPct < 27) return 'silt loam';
  return 'loam';
}
