/**
 * PlantNet identify-from-photo client. Free tier ~500-1000 calls/day.
 *
 * Used as a fallback when Claude vision returns low confidence on a crop
 * diagnostic. PlantNet is good at species/family identification, weaker at
 * naming a pest or disease, so it complements rather than replaces Claude.
 *
 * Key is optional. If PLANTNET_API_KEY is unset, identifyPlant returns null
 * and callers fall through gracefully.
 */

const PLANTNET_URL = 'https://my-api.plantnet.org/v2/identify/crops';
const TIMEOUT_MS = 30_000;

export interface PlantNetResult {
  scientificName: string;
  commonNames: string[];
  family: string;
  genus: string;
  score: number;
  candidates: Array<{ name: string; score: number }>;
}

interface PlantNetSpecies {
  scientificName?: string;
  commonNames?: string[];
  family?: { scientificName?: string };
  genus?: { scientificName?: string };
}

interface PlantNetCandidate {
  score?: number;
  species?: PlantNetSpecies;
}

interface PlantNetResponse {
  results?: PlantNetCandidate[];
}

function timedFetch(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

async function fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
  try {
    const res = await timedFetch(url, init);
    if (res.ok) return res;
    throw new Error(`PlantNet ${res.status}`);
  } catch {
    return timedFetch(url, init);
  }
}

export async function identifyPlant({
  imageUrl,
  organ = 'leaf',
}: {
  imageUrl: string;
  organ?: 'leaf' | 'flower' | 'fruit' | 'bark';
}): Promise<PlantNetResult | null> {
  const key = process.env.PLANTNET_API_KEY;
  if (!key) return null;

  // Pull the image to a Blob so we can post multipart. PlantNet also accepts
  // image URLs via the `images` field in JSON but the multipart path is more
  // forgiving when the upstream R2 URL is signed.
  let imageBlob: Blob;
  try {
    const imgRes = await timedFetch(imageUrl, { method: 'GET' });
    if (!imgRes.ok) return null;
    imageBlob = await imgRes.blob();
  } catch {
    return null;
  }

  const form = new FormData();
  form.append('images', imageBlob, 'crop.jpg');
  form.append('organs', organ);

  let res: Response;
  try {
    res = await fetchWithRetry(`${PLANTNET_URL}?api-key=${encodeURIComponent(key)}`, {
      method: 'POST',
      body: form,
    });
  } catch {
    return null;
  }
  if (!res.ok) return null;

  const json = (await res.json()) as PlantNetResponse;
  const candidates = json.results ?? [];
  if (candidates.length === 0) return null;
  const top = candidates[0]!;
  const species = top.species ?? {};

  return {
    scientificName: species.scientificName ?? 'Unknown',
    commonNames: species.commonNames ?? [],
    family: species.family?.scientificName ?? '',
    genus: species.genus?.scientificName ?? '',
    score: typeof top.score === 'number' ? top.score : 0,
    candidates: candidates.slice(0, 5).map((c) => ({
      name: c.species?.scientificName ?? 'Unknown',
      score: typeof c.score === 'number' ? c.score : 0,
    })),
  };
}
