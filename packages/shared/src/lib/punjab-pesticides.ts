// Static registry of common pesticides used in Pakistani Punjab plus their
// typical pre-harvest interval. Hand-curated, not exhaustive. The spray planner
// uses this to auto-fill PHI when a user picks a pesticide name.

import data from './punjab-pesticides.json' with { type: 'json' };

export interface PesticideEntry {
  name: string;
  phiDays: number;
  category: 'insecticide' | 'herbicide' | 'fungicide' | 'miticide';
  commonOn: string[];
}

export const punjabPesticides: readonly PesticideEntry[] = data as PesticideEntry[];

export function findPesticide(name: string): PesticideEntry | null {
  const needle = name.trim().toLowerCase();
  return punjabPesticides.find((p) => p.name.toLowerCase() === needle) ?? null;
}

export function searchPesticides(query: string, limit = 10): PesticideEntry[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return punjabPesticides.slice(0, limit);
  return punjabPesticides
    .filter((p) => p.name.toLowerCase().includes(needle) || p.category.includes(needle))
    .slice(0, limit);
}
