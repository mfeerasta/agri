/**
 * Pakistani agriculture unit conversions.
 */

export const KG_PER_MANN = 40; // 1 mann (Punjab) = 40 kg
export const KG_PER_MAUND = 40; // synonym
export const SQM_PER_ACRE = 4046.8564224;
export const ACRE_PER_KANAL = 1 / 8; // 1 kanal = 1/8 acre
export const KANAL_PER_MARLA = 1 / 20; // 1 marla = 1/20 kanal

export function kgToMann(kg: number): number {
  return kg / KG_PER_MANN;
}

export function mannToKg(mann: number): number {
  return mann * KG_PER_MANN;
}

export function acreToKanal(acre: number): number {
  return acre * 8;
}

export function kanalToAcre(kanal: number): number {
  return kanal * ACRE_PER_KANAL;
}

export function marlaToAcre(marla: number): number {
  return kanalToAcre(marla * KANAL_PER_MARLA);
}

export type AreaUnit = 'acre' | 'kanal' | 'marla' | 'sqm';
export type WeightUnit = 'kg' | 'mann' | 'tonne';

export function formatArea(value: number, unit: AreaUnit, locale: 'en' | 'ur' = 'en'): string {
  const labels: Record<AreaUnit, { en: string; ur: string }> = {
    acre: { en: 'acre', ur: 'ایکڑ' },
    kanal: { en: 'kanal', ur: 'کنال' },
    marla: { en: 'marla', ur: 'مرلہ' },
    sqm: { en: 'm²', ur: 'مربع میٹر' },
  };
  return `${value.toFixed(2)} ${labels[unit][locale]}`;
}

export function formatWeight(value: number, unit: WeightUnit, locale: 'en' | 'ur' = 'en'): string {
  const labels: Record<WeightUnit, { en: string; ur: string }> = {
    kg: { en: 'kg', ur: 'کلو' },
    mann: { en: 'mann', ur: 'من' },
    tonne: { en: 'tonne', ur: 'ٹن' },
  };
  return `${value.toFixed(2)} ${labels[unit][locale]}`;
}
