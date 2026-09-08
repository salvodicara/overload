import 'fake-indexeddb/auto';
import { afterEach, expect, it } from 'vitest';
import {
  scaleFood,
  summarizeEntries,
  nutritionDayWithEntries,
  validateFoodEntries,
  type FoodEntry,
} from '../foodDiary';
import { db, mutateDiaryEntries, saveNutrition } from '../db';
const entry = (id = 'a'): FoodEntry => ({
  id,
  food: {
    id: 'oats',
    name: 'Oats',
    basis: 'g',
    source: 'usda',
    nutrients: { kcal: 380, proteinG: 12, ironMg: 4 },
  },
  quantity: 50,
  meal: 'breakfast',
});
afterEach(async () => {
  await db.delete();
});
it('scales known nutrients and identifies unknown totals without guessing zero', () => {
  expect(scaleFood(entry().food, 50)).toEqual({ kcal: 190, proteinG: 6, ironMg: 2 });
  const result = summarizeEntries([
    entry(),
    { ...entry('b'), food: { ...entry().food, nutrients: { kcal: 100 } } },
  ]);
  expect(result.totals.proteinG).toBe(6);
  expect(result.incomplete).toContain('proteinG');
  expect(result.incomplete).not.toContain('kcal');
  expect(result.totals.vitaminCMg).toBeUndefined();
});
it('rejects negative quantities, nonfinite nutrients, duplicate IDs and unknown nutrients', () => {
  for (const bad of [
    { ...entry(), quantity: -1 },
    { ...entry(), food: { ...entry().food, nutrients: { kcal: Infinity } } },
    { ...entry(), food: { ...entry().food, nutrients: { madeUp: 10 } } },
  ])
    expect(() => validateFoodEntries([bad])).toThrow();
  expect(() => validateFoodEntries([entry(), entry()])).toThrow();
});
it('preserves legacy totals once and recomputes summary caches', () => {
  const legacy = { id: '2026-09-08', date: '2026-09-08', kcal: 1000, proteinG: 40, updatedAt: 1 };
  const next = nutritionDayWithEntries(legacy.date, [entry()], legacy);
  expect(next.entries).toHaveLength(2);
  expect(next.kcal).toBe(1190);
  expect(next.entries?.[0].food.source).toBe('manual');
  const empty = nutritionDayWithEntries(legacy.date, [], { ...next, entries: [] });
  expect(empty.kcal).toBeNull();
  expect(empty.entries).toEqual([]);
});
it('atomic additive mutation preserves concurrent additions and retry IDs', async () => {
  await db.open();
  await saveNutrition('2026-09-08', { kcal: 1000 });
  await Promise.all([
    mutateDiaryEntries('2026-09-08', { kind: 'add', entries: [entry()] }),
    mutateDiaryEntries('2026-09-08', { kind: 'add', entries: [entry('b')] }),
  ]);
  await mutateDiaryEntries('2026-09-08', { kind: 'add', entries: [entry()] });
  const day = await db.nutrition.get('2026-09-08');
  expect(day?.entries).toHaveLength(3);
  expect(day?.kcal).toBe(1380);
});
it('manual patches modify only the explicit manual snapshot and retain foods', async () => {
  await db.open();
  await saveNutrition('2026-09-08', { kcal: 1000 });
  await mutateDiaryEntries('2026-09-08', { kind: 'add', entries: [entry()] });
  const day = await saveNutrition('2026-09-08', { kcal: 1200 });
  expect(day.kcal).toBe(1390);
  expect(day.entries).toHaveLength(2);
});
it('deleting the last food never resurrects its old cached nutrients', async () => {
  await db.open();
  await mutateDiaryEntries('2026-09-08', { kind: 'add', entries: [entry()] });
  const day = await mutateDiaryEntries('2026-09-08', { kind: 'delete', id: 'a' });
  expect(day.entries).toEqual([]);
  expect(day.kcal).toBeNull();
});
it('backup diary validation rejects malformed snapshots and recomputes cached totals', async () => {
  const { parseBackup } = await import('../importer');
  const backup = {
    version: 2,
    workouts: [],
    routines: [],
    folders: [],
    notes: [],
    measurements: [],
    nutrition: [
      {
        id: '2026-09-08',
        date: '2026-09-08',
        kcal: 9999,
        proteinG: 9999,
        entries: [entry()],
        updatedAt: 1,
      },
    ],
    customExercises: [],
    settings: {
      id: 'settings',
      updatedAt: 1,
      savedMeals: [{ id: 'meal', name: 'Breakfast', entries: [entry()] }],
    },
  };
  const result = parseBackup(JSON.stringify(backup));
  expect(result.version === 2 && result.nutrition[0].kcal).toBe(190);
  backup.settings.savedMeals[0].entries[0].quantity = -1;
  expect(() => parseBackup(JSON.stringify(backup))).toThrow();
});
