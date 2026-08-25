import { describe, expect, it } from 'vitest';
import { toBackupJson, toCsv, type BackupData } from '../exporter';
import { parseBackup } from '../importer';
import type { Routine, Settings, Workout } from '../types';

const WORKOUTS: Workout[] = [
  {
    id: 'app-2026-06-01-a',
    dayLabel: 'A',
    date: '2026-06-01',
    startTs: 10,
    sets: [
      { exerciseId: 'squat', weightKg: 60, reps: 5, done: true },
      { exerciseId: 'squat', weightKg: 65, reps: 3, done: false },
      { exerciseId: 'bench', weightKg: 40, reps: 8, done: true },
    ],
    volumeKg: 620,
    updatedAt: 10,
    source: 'app',
  },
  {
    id: 'hevy-2026-06-08-b',
    dayLabel: 'B, "pesante"',
    date: '2026-06-08',
    startTs: 20,
    sets: [{ exerciseId: 'bench', weightKg: 42.5, reps: 6, done: true }],
    volumeKg: 255,
    updatedAt: 20,
    source: 'hevy',
  },
];

const ROUTINES: Routine[] = [{ id: 'r1', name: 'Operazione Rientro', exercises: [], updatedAt: 1 }];

const SETTINGS: Settings = { id: 'settings', programStartDate: '2026-06-01', updatedAt: 2 };

const BACKUP_DATA: BackupData = {
  workouts: WORKOUTS,
  routines: ROUTINES,
  folders: [{ id: 'folder-1', name: 'Forza', updatedAt: 3 }],
  notes: [
    {
      id: 'squat',
      technique: 'Tieni il brace',
      entries: [{ date: '2026-06-01', text: 'Buona profondita' }],
      updatedAt: 4,
    },
  ],
  measurements: [{ id: 'm1', date: '2026-06-01', metric: 'weight', value: 82.5, updatedAt: 5 }],
  nutrition: [
    { id: '2026-06-01', date: '2026-06-01', kcal: 2400, proteinG: 180, updatedAt: 6 },
  ],
  customExercises: [
    { id: 'custom:1', name: 'Press personale', muscleGroup: 'shoulders', updatedAt: 7 },
  ],
  settings: { ...SETTINGS, unit: 'lb', locale: 'it', weeklyGoal: 4 },
};

const NAMES: Record<string, string> = {
  squat: 'Squat',
  bench: 'Panca Piana, manubri',
};
const exerciseName = (id: string): string => NAMES[id] ?? id;

describe('toBackupJson', () => {
  it('round-trips every local collection in a version 2 backup', () => {
    const json = toBackupJson(BACKUP_DATA);
    expect(parseBackup(json)).toEqual({
      version: 2,
      ...BACKUP_DATA,
    });
  });

  it('is pretty printed', () => {
    expect(toBackupJson({ ...BACKUP_DATA, workouts: [] })).toContain('\n  "version": 2');
  });
});

describe('toCsv', () => {
  const csv = toCsv(WORKOUTS, exerciseName);
  const lines = csv.split('\n');

  it('starts with the fixed header', () => {
    expect(lines[0]).toBe('date,day,exercise,weight_kg,reps');
  });

  it('emits one row per done set', () => {
    expect(lines).toHaveLength(4);
  });

  it('writes date, day, exercise name, weight and reps', () => {
    expect(lines[1]).toBe('2026-06-01,A,Squat,60,5');
  });

  it('quotes values containing commas or quotes', () => {
    expect(lines[2]).toBe('2026-06-01,A,"Panca Piana, manubri",40,8');
    expect(lines[3]).toBe('2026-06-08,"B, ""pesante""","Panca Piana, manubri",42.5,6');
  });

  it('emits only the header when there is nothing done', () => {
    expect(toCsv([], exerciseName)).toBe('date,day,exercise,weight_kg,reps');
  });
});
