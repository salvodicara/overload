import { describe, expect, it } from 'vitest';
import { parseBackup, planImport, type BackupV1, type BackupV2 } from '../importer';
import type {
  CustomExercise,
  ExerciseNote,
  Folder,
  Measurement,
  NutritionDay,
  Routine,
  Settings,
  Workout,
} from '../types';

function workout(id: string, date = '2026-06-01'): Workout {
  return {
    id,
    date,
    startTs: 1,
    sets: [{ exerciseId: 'squat', weightKg: 60, reps: 5, done: true }],
    volumeKg: 300,
    updatedAt: 1,
    source: 'app',
  };
}

const ROUTINE: Routine = {
  id: 'r1',
  name: 'Operazione Rientro',
  exercises: [],
  updatedAt: 2,
};

const SETTINGS: Settings = { id: 'settings', programStartDate: '2026-06-01', updatedAt: 3 };

describe('planImport', () => {
  it('keeps everything when nothing exists yet', () => {
    const incoming = [workout('a'), workout('b')];
    expect(planImport(new Set<string>(), incoming)).toEqual({ fresh: incoming, duplicates: 0 });
  });

  it('drops workouts whose id already exists', () => {
    const plan = planImport(new Set(['a']), [workout('a'), workout('b')]);
    expect(plan.fresh.map((w) => w.id)).toEqual(['b']);
    expect(plan.duplicates).toBe(1);
  });

  it('keeps the first occurrence of a duplicate inside the incoming batch', () => {
    const first = workout('a', '2026-06-01');
    const second = workout('a', '2026-07-01');
    const plan = planImport(new Set<string>(), [first, second]);
    expect(plan.fresh).toEqual([first]);
    expect(plan.duplicates).toBe(1);
  });

  it('reports every duplicate when re-importing the same batch', () => {
    const incoming = [workout('a'), workout('b')];
    expect(planImport(new Set(['a', 'b']), incoming)).toEqual({ fresh: [], duplicates: 2 });
  });

  it('handles an empty batch', () => {
    expect(planImport(new Set(['a']), [])).toEqual({ fresh: [], duplicates: 0 });
  });
});

describe('parseBackup', () => {
  const legacyBackup: BackupV1 = {
    version: 1,
    workouts: [workout('a')],
    routines: [ROUTINE],
    settings: SETTINGS,
  };

  it('still accepts a legacy version 1 backup without changing its shape', () => {
    expect(parseBackup(JSON.stringify(legacyBackup))).toEqual(legacyBackup);
  });

  it('accepts a backup without settings', () => {
    const parsed = parseBackup(JSON.stringify({ version: 1, workouts: [], routines: [] }));
    expect(parsed.workouts).toEqual([]);
    expect(parsed.settings).toBeUndefined();
  });

  it.each([
    ['not json at all', 'nope{'],
    ['a json array', '[]'],
    ['null', 'null'],
    ['an unknown version', JSON.stringify({ version: 3, workouts: [], routines: [] })],
    ['missing workouts', JSON.stringify({ version: 1, routines: [] })],
    ['missing routines', JSON.stringify({ version: 1, workouts: [] })],
    ['non-array workouts', JSON.stringify({ version: 1, workouts: {}, routines: [] })],
  ])('rejects %s with the import.invalid key', (_label, json) => {
    expect(() => parseBackup(json)).toThrowError('import.invalid');
  });

  const v2Backup: BackupV2 = {
    version: 2,
    workouts: [
      {
        ...workout('complete'),
        routineId: 'r1',
        dayLabel: 'A',
        endTs: 2,
        note: 'legacy workout note',
        exerciseNotes: [{ exerciseId: 'squat', text: 'optional exercise note' }],
        sets: [
          {
            exerciseId: 'squat',
            weightKg: 62.5,
            reps: 5,
            done: true,
            tracking: 'weight_reps',
            kind: 'working',
            durationSec: 45,
            isPr: true,
          },
        ],
      },
    ],
    routines: [
      {
        ...ROUTINE,
        folderId: 'f1',
        warmup: 'Mobilita',
        exercises: [
          {
            exerciseId: 'squat',
            sets: 3,
            repMin: 5,
            repMax: null,
            restSec: 90,
            note: 'brace',
            startWeightKg: 57.5,
            incrementKg: 2.5,
            tracking: 'weight_reps',
            warmupSets: [{ weightKg: 20, reps: 10, durationSec: 30 }],
          },
        ],
      },
    ],
    folders: [{ id: 'f1', name: 'Forza', updatedAt: 4 } satisfies Folder],
    notes: [
      {
        id: 'squat',
        technique: 'Ginocchia fuori',
        entries: [{ date: '2026-06-01', text: 'Solido' }],
        updatedAt: 5,
      } satisfies ExerciseNote,
    ],
    measurements: [
      { id: 'm1', date: '2026-06-01', metric: 'weight', value: 82.4, updatedAt: 6 } satisfies Measurement,
    ],
    nutrition: [
      {
        id: '2026-06-01',
        date: '2026-06-01',
        kcal: 2400,
        proteinG: 180,
        updatedAt: 7,
      } satisfies NutritionDay,
    ],
    customExercises: [
      { id: 'custom:1', name: 'Press personalizzato', muscleGroup: 'shoulders', updatedAt: 8 } satisfies CustomExercise,
    ],
    settings: {
      ...SETTINGS,
      unit: 'lb',
      locale: 'it',
      kcalTarget: 2500,
      proteinTarget: 190,
      weeklyGoal: 4,
    },
  };

  it('preserves every version 2 collection and optional legacy field', () => {
    expect(parseBackup(JSON.stringify(v2Backup))).toEqual(v2Backup);
  });

  it.each([
    'workouts',
    'routines',
    'folders',
    'notes',
    'measurements',
    'nutrition',
    'customExercises',
    'settings',
  ] as const)('rejects a version 2 backup missing %s', (missing) => {
    const partial = { ...v2Backup } as Record<string, unknown>;
    delete partial[missing];

    expect(() => parseBackup(JSON.stringify(partial))).toThrowError('import.invalid');
  });

  it.each([
    ['workouts', {}],
    ['routines', null],
    ['folders', 'folders'],
    ['notes', 1],
    ['measurements', {}],
    ['nutrition', null],
    ['customExercises', 'customExercises'],
    ['settings', []],
    ['settings', { id: 'other', updatedAt: 1 }],
  ])('rejects a version 2 backup with invalid %s', (field, invalid) => {
    expect(() =>
      parseBackup(JSON.stringify({ ...v2Backup, [field]: invalid })),
    ).toThrowError('import.invalid');
  });

  it('rejects unrecognised version 2 collections instead of silently losing them', () => {
    expect(() =>
      parseBackup(JSON.stringify({ ...v2Backup, futureCollection: [] })),
    ).toThrowError('import.invalid');
  });
});
