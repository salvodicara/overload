export type WeightUnit = 'kg' | 'lb';

const LB_PER_KG = 2.2046226218;

const roundInput = (value: number): number => Math.round(value * 10) / 10;

export function displayWeight(kg: number, unit: WeightUnit): number {
  return roundInput(unit === 'lb' ? kg * LB_PER_KG : kg);
}

export function displayVolume(kg: number, unit: WeightUnit): number {
  return unit === 'kg' ? Math.round(kg) : displayWeight(kg, unit);
}

export function canonicalWeight(value: number, unit: WeightUnit): number {
  return unit === 'lb' ? value / LB_PER_KG : value;
}

export function weightLabel(unit: WeightUnit): string {
  return unit;
}

export function formatWeight(kg: number, unit: WeightUnit, locale: string): string {
  return `${displayWeight(kg, unit).toLocaleString(locale === 'it' ? 'it-IT' : 'en-GB')} ${unit}`;
}
