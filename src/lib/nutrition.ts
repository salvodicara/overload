import type { NutritionDay } from './types';
import { nutritionDayWithEntries, validateFoodEntries } from './foodDiary';

export const NUTRIENT_FIELDS = [
  'kcal',
  'proteinG',
  'carbsG',
  'fatG',
  'saturatedFatG',
  'fiberG',
  'sugarG',
  'saltG',
] as const;
export type NutrientField = (typeof NUTRIENT_FIELDS)[number];
export type NutritionPatch = Partial<Pick<NutritionDay, NutrientField>>;

export function validNutrient(value: unknown): boolean {
  return value === null || (typeof value === 'number' && Number.isFinite(value) && value >= 0);
}

export function validNutritionDay(value: unknown): value is NutritionDay {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const day = value as Record<string, unknown>;
  if (day.entries !== undefined) {
    try {
      validateFoodEntries(day.entries);
    } catch {
      return false;
    }
  }
  return (
    typeof day.date === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(day.date) &&
    Number.isFinite(Date.parse(day.date)) &&
    new Date(day.date).toISOString().slice(0, 10) === day.date &&
    day.id === day.date &&
    typeof day.updatedAt === 'number' &&
    Number.isFinite(day.updatedAt) &&
    NUTRIENT_FIELDS.every(
      (field) =>
        (field !== 'kcal' && field !== 'proteinG' && day[field] === undefined) ||
        validNutrient(day[field]),
    )
  );
}

export function normalizeNutritionDay(day: NutritionDay): NutritionDay {
  if (!validNutritionDay(day)) throw new Error('diet.invalid');
  return day.entries === undefined
    ? day
    : {
        ...nutritionDayWithEntries(day.date, day.entries, day),
        updatedAt: day.updatedAt,
      };
}
