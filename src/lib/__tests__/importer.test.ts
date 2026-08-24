import { describe, expect, it } from 'vitest';
import { parseBackup, planImport, type Backup } from '../importer';
import type { Routine, Settings, Workout } from '../types';

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
  const backup: Backup = {
    version: 1,
    workouts: [workout('a')],
    routines: [ROUTINE],
    settings: SETTINGS,
  };

  it('round-trips a serialized backup', () => {
    expect(parseBackup(JSON.stringify(backup))).toEqual(backup);
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
    ['a wrong version', JSON.stringify({ version: 2, workouts: [], routines: [] })],
    ['missing workouts', JSON.stringify({ version: 1, routines: [] })],
    ['missing routines', JSON.stringify({ version: 1, workouts: [] })],
    ['non-array workouts', JSON.stringify({ version: 1, workouts: {}, routines: [] })],
  ])('rejects %s with the import.invalid key', (_label, json) => {
    expect(() => parseBackup(json)).toThrowError('import.invalid');
  });
});
