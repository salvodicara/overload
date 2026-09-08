import { expect, it } from 'vitest';
import { parseBackup } from '../importer';

const backup = (nutrients: Record<string, unknown>) =>
  JSON.stringify({
    version: 2,
    workouts: [],
    routines: [],
    folders: [],
    notes: [],
    measurements: [],
    customExercises: [],
    settings: { id: 'settings', updatedAt: 0 },
    nutrition: [
      { id: '2026-09-07', date: '2026-09-07', updatedAt: 1, kcal: null, proteinG: 0, ...nutrients },
    ],
  });

it('accepts old nutrition backups and preserves zero, missing, and fractional nutrient totals', () => {
  const old = parseBackup(backup({}));
  expect(old).toHaveProperty('nutrition.0.proteinG', 0);
  expect(old).not.toHaveProperty('nutrition.0.carbsG');
  expect(
    parseBackup(
      backup({ carbsG: 12.5, fatG: null, saturatedFatG: 0, fiberG: 2.2, sugarG: 1.1, saltG: 0.25 }),
    ),
  ).toHaveProperty('nutrition.0.saltG', 0.25);
});

it.each(['kcal', 'proteinG', 'carbsG', 'fatG', 'saturatedFatG', 'fiberG', 'sugarG', 'saltG'])(
  'rejects negative or nonnumeric %s in backups',
  (field) => {
    expect(() => parseBackup(backup({ [field]: -1 }))).toThrow('import.invalid');
    expect(() => parseBackup(backup({ [field]: '2.5' }))).toThrow('import.invalid');
  },
);

it('rejects nonfinite JSON nutrient values', () => {
  expect(() => parseBackup(backup({ carbsG: 'OVERFLOW' }).replace('"OVERFLOW"', '1e400'))).toThrow(
    'import.invalid',
  );
});

it('rejects nonexistent calendar dates before they reach the nutrition history', () => {
  expect(() => parseBackup(backup({}).replaceAll('2026-09-07', '2026-02-30'))).toThrow('import.invalid');
});
