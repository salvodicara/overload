import { describe, expect, it } from 'vitest';
import { toBackupJson, toCsv } from '../exporter';
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

const ROUTINES: Routine[] = [{ id: 'r1', name: 'Operazione Rientro', days: [], updatedAt: 1 }];

const SETTINGS: Settings = { id: 'settings', programStartDate: '2026-06-01', updatedAt: 2 };

const NAMES: Record<string, string> = {
  squat: 'Squat',
  bench: 'Panca Piana, manubri',
};
const exerciseName = (id: string): string => NAMES[id] ?? id;

describe('toBackupJson', () => {
  it('round-trips through parseBackup', () => {
    const json = toBackupJson(WORKOUTS, ROUTINES, SETTINGS);
    expect(parseBackup(json)).toEqual({
      version: 1,
      workouts: WORKOUTS,
      routines: ROUTINES,
      settings: SETTINGS,
    });
  });

  it('round-trips without settings', () => {
    const parsed = parseBackup(toBackupJson(WORKOUTS, ROUTINES, undefined));
    expect(parsed.settings).toBeUndefined();
    expect(parsed.workouts).toEqual(WORKOUTS);
  });

  it('is pretty printed', () => {
    expect(toBackupJson([], [], undefined)).toContain('\n  "version": 1');
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
