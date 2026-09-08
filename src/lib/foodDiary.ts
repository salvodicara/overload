import type { NutritionDay } from './types';

export const NUTRIENT_META = {
  kcal: { unit: 'kcal' },
  proteinG: { unit: 'g' },
  carbsG: { unit: 'g' },
  fatG: { unit: 'g' },
  saturatedFatG: { unit: 'g' },
  fiberG: { unit: 'g' },
  sugarG: { unit: 'g' },
  saltG: { unit: 'g' },
  calciumMg: { unit: 'mg' },
  ironMg: { unit: 'mg' },
  magnesiumMg: { unit: 'mg' },
  potassiumMg: { unit: 'mg' },
  zincMg: { unit: 'mg' },
  sodiumMg: { unit: 'mg' },
  vitaminAMcg: { unit: 'mcg' },
  vitaminCMg: { unit: 'mg' },
  vitaminDMcg: { unit: 'mcg' },
  vitaminEMg: { unit: 'mg' },
  vitaminKMcg: { unit: 'mcg' },
  vitaminB1Mg: { unit: 'mg' },
  vitaminB2Mg: { unit: 'mg' },
  vitaminB3Mg: { unit: 'mg' },
  vitaminB6Mg: { unit: 'mg' },
  vitaminB12Mcg: { unit: 'mcg' },
  folateMcg: { unit: 'mcg' },
} as const;
export type NutrientKey = keyof typeof NUTRIENT_META;
export type Food = {
  id: string;
  name: string;
  nameIt?: string;
  brand?: string;
  basis: 'g' | 'ml';
  nutrients: Partial<Record<NutrientKey, number>>;
  source: 'usda' | 'openfoodfacts' | 'custom' | 'import' | 'manual';
  sourceId?: string;
};
export type FoodEntry = {
  id: string;
  food: Food;
  quantity: number;
  meal: 'breakfast' | 'lunch' | 'dinner' | 'snack';
};
export type SavedMeal = { id: string; name: string; entries: FoodEntry[] };
export class FoodDiaryError extends Error {
  constructor(
    public path: string,
    message: string,
  ) {
    super(`${path}: ${message}`);
    this.name = 'FoodDiaryError';
  }
}
function fail(path: string, message: string): never {
  throw new FoodDiaryError(path, message);
}
function object(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    fail(path, 'Expected an object.');
  return value as Record<string, unknown>;
}
function text(value: unknown, path: string, max = 300): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max)
    fail(path, 'Expected nonempty text.');
  return value;
}
function amount(value: unknown, path: string, max = 1e9): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > max)
    fail(path, 'Expected a finite nonnegative amount.');
  return value;
}
export function validateFood(value: unknown, path = 'food'): Food {
  const food = object(value, path);
  if (food.basis !== 'g' && food.basis !== 'ml')
    fail(path + '.basis', 'Use g or ml; do not guess density.');
  if (!['usda', 'openfoodfacts', 'custom', 'import', 'manual'].includes(food.source as string))
    fail(path + '.source', 'Unknown food source.');
  const nutrients: Food['nutrients'] = {};
  for (const [key, value] of Object.entries(object(food.nutrients, path + '.nutrients'))) {
    if (!Object.hasOwn(NUTRIENT_META, key)) fail(path + '.nutrients.' + key, 'Unknown nutrient.');
    nutrients[key as NutrientKey] = amount(value, path + '.nutrients.' + key);
  }
  return {
    id: text(food.id, path + '.id'),
    name: text(food.name, path + '.name'),
    basis: food.basis,
    nutrients,
    source: food.source as Food['source'],
    ...(food.nameIt === undefined ? {} : { nameIt: text(food.nameIt, path + '.nameIt') }),
    ...(food.brand === undefined ? {} : { brand: text(food.brand, path + '.brand') }),
    ...(food.sourceId === undefined ? {} : { sourceId: text(food.sourceId, path + '.sourceId') }),
  };
}
export function validateFoodEntries(value: unknown): FoodEntry[] {
  if (!Array.isArray(value) || value.length > 500)
    fail('entries', 'Expected at most 500 food entries.');
  const ids = new Set<string>();
  return value.map((entry, index) => {
    const path = `entries[${index}]`;
    const item = object(entry, path);
    const id = text(item.id, path + '.id');
    if (ids.has(id)) fail(path + '.id', 'Duplicate entry ID.');
    ids.add(id);
    const quantity = amount(item.quantity, path + '.quantity', 100000);
    if (quantity === 0) fail(path + '.quantity', 'Quantity must be greater than zero.');
    if (!['breakfast', 'lunch', 'dinner', 'snack'].includes(item.meal as string))
      fail(path + '.meal', 'Unknown meal.');
    return {
      id,
      food: validateFood(item.food, path + '.food'),
      quantity,
      meal: item.meal as FoodEntry['meal'],
    };
  });
}
export function validateSavedMeals(value: unknown): SavedMeal[] {
  if (!Array.isArray(value) || value.length > 100)
    fail('savedMeals', 'Expected at most 100 saved meals.');
  const ids = new Set<string>();
  return value.map((entry, index) => {
    const path = `savedMeals[${index}]`;
    const item = object(entry, path);
    const id = text(item.id, path + '.id');
    if (ids.has(id)) fail(path + '.id', 'Duplicate saved meal ID.');
    ids.add(id);
    return {
      id,
      name: text(item.name, path + '.name'),
      entries: validateFoodEntries(item.entries),
    };
  });
}
export function scaleFood(food: Food, quantity: number): Food['nutrients'] {
  const valid = validateFood(food);
  if (amount(quantity, 'quantity', 100000) === 0)
    fail('quantity', 'Quantity must be greater than zero.');
  return Object.fromEntries(
    Object.entries(valid.nutrients).map(([key, value]) => [key, (value * quantity) / 100]),
  );
}
export function summarizeEntries(entries: FoodEntry[]): {
  totals: Food['nutrients'];
  incomplete: NutrientKey[];
} {
  const totals: Food['nutrients'] = {};
  const incomplete: NutrientKey[] = [];
  const valid = validateFoodEntries(entries);
  for (const key of Object.keys(NUTRIENT_META) as NutrientKey[]) {
    let known = 0,
      total = 0;
    for (const entry of valid) {
      const value = entry.food.nutrients[key];
      if (value !== undefined) {
        known++;
        total += (value * entry.quantity) / 100;
      }
    }
    if (known) totals[key] = total;
    if (known < valid.length || !valid.length) incomplete.push(key);
  }
  return { totals, incomplete };
}
export const SUMMARY_NUTRIENTS = [
  'kcal',
  'proteinG',
  'carbsG',
  'fatG',
  'saturatedFatG',
  'fiberG',
  'sugarG',
  'saltG',
] as const;
export function legacyManualEntry(day: NutritionDay): FoodEntry | undefined {
  const nutrients: Food['nutrients'] = {};
  for (const field of SUMMARY_NUTRIENTS) {
    const value = day[field];
    if (value !== undefined && value !== null) nutrients[field] = value;
  }
  if (!Object.keys(nutrients).length) return undefined;
  return {
    id: `manual:${day.date}`,
    quantity: 100,
    meal: 'snack',
    food: {
      id: `manual:${day.date}`,
      name: 'Manual totals',
      basis: 'g',
      source: 'manual',
      nutrients,
    },
  };
}
/** The first transition keeps legacy totals as an explicit snapshot. Existing entries are supplied by caller. */
export function nutritionDayWithEntries(
  date: string,
  entries: FoodEntry[],
  previous?: NutritionDay,
): NutritionDay {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(Date.parse(date)) ||
    new Date(date).toISOString().slice(0, 10) !== date
  )
    fail('date', 'Expected a valid YYYY-MM-DD date.');
  const legacy =
    previous && previous.entries === undefined ? legacyManualEntry(previous) : undefined;
  const next = validateFoodEntries(legacy ? [legacy, ...entries] : entries);
  const { totals } = summarizeEntries(next);
  return {
    id: date,
    date,
    kcal: totals.kcal ?? null,
    proteinG: totals.proteinG ?? null,
    ...Object.fromEntries(SUMMARY_NUTRIENTS.map((key) => [key, totals[key] ?? null])),
    entries: next,
    updatedAt: Date.now(),
  };
}
export type DiaryMutation =
  | { kind: 'add'; entries: FoodEntry[] }
  | { kind: 'update'; entry: FoodEntry }
  | { kind: 'delete'; id: string };
export function applyDiaryMutation(
  date: string,
  previous: NutritionDay | undefined,
  mutation: DiaryMutation,
): NutritionDay {
  let entries = previous?.entries ?? [];
  if (mutation.kind === 'add') {
    const incoming = validateFoodEntries(mutation.entries);
    entries = [
      ...entries,
      ...incoming.filter((entry) => !entries.some((existing) => existing.id === entry.id)),
    ];
  } else if (mutation.kind === 'update') {
    const entry = validateFoodEntries([mutation.entry])[0];
    if (!entries.some((existing) => existing.id === entry.id))
      fail('entry.id', 'Entry no longer exists.');
    entries = entries.map((existing) => (existing.id === entry.id ? entry : existing));
  } else entries = entries.filter((entry) => entry.id !== mutation.id);
  return nutritionDayWithEntries(date, entries, previous);
}
