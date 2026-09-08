import { describe, expect, it } from 'vitest';
import { parseBackup } from '../importer';
import { validNutrient } from '../nutrition';
import { toCsv } from '../exporter';
import type { Workout } from '../types';

const backup = () => ({
  version: 2,
  workouts: [],
  routines: [],
  folders: [],
  notes: [],
  measurements: [],
  nutrition: [],
  customExercises: [],
  settings: { id: 'settings', updatedAt: 1 },
});
describe('backup rejects records that can corrupt rendered personal data', () => {
  it.each([
    ['measurements', [{ id: 'm', date: '2026-09-08', metric: 'waist', value: null, updatedAt: 1 }]],
    ['measurements', [{ id: 'm', date: '2026-02-30', metric: 'weight', value: 70, updatedAt: 1 }]],
    ['measurements', [{ id: 'm', date: '2026-09-08', metric: 'unknown', value: 70, updatedAt: 1 }]],
    [
      'measurements',
      [{ id: 'm', date: '2026-09-08', metric: 'weight', value: 1e308, updatedAt: 1 }],
    ],
    [
      'workouts',
      [
        {
          id: 'w',
          date: '2026-09-08',
          startTs: 1,
          sets: [null],
          volumeKg: 0,
          updatedAt: 1,
          source: 'app',
        },
      ],
    ],
    [
      'routines',
      [
        {
          id: 'r',
          name: 'R',
          exercises: [{ exerciseId: 'x', sets: 3, repMin: 5, repMax: 8, restSec: -1 }],
          updatedAt: 1,
        },
      ],
    ],
    ['folders', [{ id: 'f', name: null, updatedAt: 1 }]],
    ['notes', [{ id: 'n', entries: [{ date: '2026-09-08', text: null }], updatedAt: 1 }]],
    ['customExercises', [{ id: 'custom:x', name: 'X', muscleGroup: null, updatedAt: 1 }]],
    ['settings', { id: 'settings', unit: 'stones', updatedAt: 1 }],
    ['settings', { id: 'settings', kcalTarget: -1, updatedAt: 1 }],
  ])('rejects invalid %s records before restoring', (field, value) => {
    expect(() => parseBackup(JSON.stringify({ ...backup(), [field]: value }))).toThrow(
      'import.invalid',
    );
  });
  it('preserves legacy multi-day routines and extension fields', () => {
    const value = {
      version: 1,
      workouts: [],
      routines: [
        {
          id: 'r',
          name: 'Legacy',
          days: [{ label: 'A', name: 'A', exercises: [] }],
          updatedAt: 1,
          extension: { keep: true },
        },
      ],
    };
    expect(parseBackup(JSON.stringify(value))).toEqual(value);
  });
  it('rejects duplicate record ids instead of silently replacing one during restore', () => {
    expect(() =>
      parseBackup(
        JSON.stringify({
          ...backup(),
          folders: [
            { id: 'f', name: 'A', updatedAt: 1 },
            { id: 'f', name: 'B', updatedAt: 2 },
          ],
        }),
      ),
    ).toThrow('import.invalid');
  });
});
it('bounds manual nutrients consistently with food snapshot validation', () => {
  expect(validNutrient(1e9)).toBe(true);
  expect(validNutrient(1e9 + 1)).toBe(false);
});
it('exports the actual duration and tracking type of timed sets', () => {
  const workout: Workout = {
    id: 'w',
    date: '2026-09-08',
    startTs: 1,
    updatedAt: 1,
    source: 'app',
    volumeKg: 0,
    sets: [
      {
        exerciseId: 'plank',
        tracking: 'duration',
        durationSec: 90,
        weightKg: 0,
        reps: 0,
        done: true,
      },
    ],
  };
  const [header, row] = toCsv([workout], () => 'Plank')
    .split('\n')
    .map((line) => line.split(','));
  expect(row[header.indexOf('duration_sec')]).toBe('90');
  expect(row[header.indexOf('tracking')]).toBe('duration');
});

it('accepts derived diary totals above the per-food nutrient cap', () => {
  const day = {
    id: '2026-09-08',
    date: '2026-09-08',
    kcal: 2e9,
    proteinG: null,
    updatedAt: 1,
    entries: [
      {
        id: 'e',
        meal: 'lunch',
        quantity: 200,
        food: {
          id: 'f',
          name: 'Label values',
          basis: 'g',
          source: 'custom',
          nutrients: { kcal: 1e9 },
        },
      },
    ],
  };
  expect(() => parseBackup(JSON.stringify({ ...backup(), nutrition: [day] }))).not.toThrow();
});
