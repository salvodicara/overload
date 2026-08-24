import { describe, expect, it } from 'vitest';
import { getPhase, suggest } from '../progression';
import type { RoutineExercise, SetLog, Workout } from '../types';
import { computeVolume } from '../volume';

const BENCH = 'bench-press';

function rx(over: Partial<RoutineExercise> = {}): RoutineExercise {
  return {
    exerciseId: BENCH,
    sets: 3,
    repMin: 8,
    repMax: 10,
    restSec: 90,
    startWeightKg: 20,
    incrementKg: 2.5,
    ...over,
  };
}

function set(weightKg: number, reps: number, done = true, exerciseId = BENCH): SetLog {
  return { exerciseId, weightKg, reps, done };
}

function workout(id: string, date: string, sets: SetLog[], over: Partial<Workout> = {}): Workout {
  return {
    id,
    date,
    startTs: Date.parse(`${date}T10:00:00Z`),
    sets,
    volumeKg: computeVolume(sets),
    updatedAt: 0,
    source: 'app',
    ...over,
  };
}

describe('getPhase', () => {
  it('is null without a program start date', () => {
    expect(getPhase(undefined, '2026-08-24')).toBeNull();
  });

  it('is null when the program starts in the future', () => {
    expect(getPhase('2026-08-25', '2026-08-24')).toBeNull();
  });

  it('starts at week 1 on the start date', () => {
    expect(getPhase('2026-08-24', '2026-08-24')).toEqual({ week: 1, key: 'reactivation' });
  });

  it('maps weeks to phases', () => {
    const start = '2026-01-01';
    const at = (days: number) => {
      const d = new Date(Date.UTC(2026, 0, 1) + days * 86400000);
      return getPhase(start, d.toISOString().slice(0, 10));
    };
    expect(at(6)).toEqual({ week: 1, key: 'reactivation' });
    expect(at(7)).toEqual({ week: 2, key: 'reactivation' });
    expect(at(14)).toEqual({ week: 3, key: 'rebuild' });
    expect(at(28)).toEqual({ week: 5, key: 'rebuild' });
    expect(at(35)).toEqual({ week: 6, key: 'progress' });
    expect(at(55)).toEqual({ week: 8, key: 'progress' });
    expect(at(56)).toEqual({ week: 9, key: 'deload' });
    expect(at(63)).toEqual({ week: 10, key: 'done' });
    expect(at(200)).toEqual({ week: 29, key: 'done' });
  });
});

describe('suggest', () => {
  it('rule 1: no history falls back to the start weight', () => {
    const s = suggest(rx(), [], null);
    expect(s).toEqual({ weights: [20, 20, 20], hintKey: 'suggest.start' });
  });

  it('rule 1: no start weight means zeroes', () => {
    const s = suggest(rx({ startWeightKg: undefined }), [], null);
    expect(s).toEqual({ weights: [0, 0, 0], hintKey: 'suggest.start' });
  });

  it('rule 1: workouts without done sets of the exercise do not count as history', () => {
    const history = [workout('w1', '2026-06-01', [set(40, 10, false), set(60, 10, true, 'squat')])];
    expect(suggest(rx(), history, null).hintKey).toBe('suggest.start');
  });

  it('rule 2: increases every set when the top of the rep range was closed', () => {
    const history = [workout('w1', '2026-06-01', [set(40, 10), set(40, 10), set(37.5, 10)])];
    expect(suggest(rx(), history, null)).toEqual({
      weights: [42.5, 42.5, 40],
      hintKey: 'suggest.increase',
    });
  });

  it('rule 2: uses the exercise increment when given', () => {
    const history = [workout('w1', '2026-06-01', [set(60, 10), set(60, 10), set(60, 10)])];
    expect(suggest(rx({ incrementKg: 5 }), history, null).weights).toEqual([65, 65, 65]);
  });

  it('rule 3: repeats the same weights when the range was not closed', () => {
    const history = [workout('w1', '2026-06-01', [set(40, 10), set(40, 9), set(40, 8)])];
    expect(suggest(rx(), history, null)).toEqual({
      weights: [40, 40, 40],
      hintKey: 'suggest.repeat',
    });
  });

  it('rule 3: an open-ended rep range never triggers an increase', () => {
    const history = [workout('w1', '2026-06-01', [set(40, 30), set(40, 30), set(40, 30)])];
    expect(suggest(rx({ repMax: null }), history, null).hintKey).toBe('suggest.repeat');
  });

  it('uses the most recent workout, tie-broken by startTs', () => {
    const history = [
      workout('w1', '2026-06-01', [set(30, 8), set(30, 8), set(30, 8)]),
      workout('w2', '2026-06-08', [set(40, 8), set(40, 8), set(40, 8)], { startTs: 100 }),
      workout('w3', '2026-06-08', [set(50, 8), set(50, 8), set(50, 8)], { startTs: 200 }),
    ];
    expect(suggest(rx(), history, null).weights).toEqual([50, 50, 50]);
  });

  it('pads and truncates the last weights to the routine set count', () => {
    const history = [workout('w1', '2026-06-01', [set(40, 8), set(45, 8)])];
    expect(suggest(rx({ sets: 4 }), history, null).weights).toEqual([40, 45, 45, 45]);
    expect(suggest(rx({ sets: 1 }), history, null).weights).toEqual([40]);
  });

  it('rule 4: reactivation forces the start weight when never logged in-app', () => {
    const history = [
      workout('w1', '2026-06-01', [set(60, 10), set(60, 10), set(60, 10)], {
        source: 'hevy',
      }),
    ];
    expect(suggest(rx(), history, { week: 1, key: 'reactivation' })).toEqual({
      weights: [20, 20, 20],
      hintKey: 'suggest.phase1',
    });
  });

  it('rule 4: does not apply once the exercise was logged in-app', () => {
    const history = [
      workout('w1', '2026-06-01', [set(60, 10), set(60, 10), set(60, 10)], {
        source: 'hevy',
      }),
      workout('w2', '2026-06-03', [set(50, 8), set(50, 8), set(50, 8)], { source: 'app' }),
    ];
    expect(suggest(rx(), history, { week: 2, key: 'reactivation' })).toEqual({
      weights: [50, 50, 50],
      hintKey: 'suggest.repeat',
    });
  });

  it('rule 5: deload takes 60% of the last weights rounded to 2.5 kg', () => {
    const history = [workout('w1', '2026-06-01', [set(60, 10), set(50, 10), set(42.5, 10)])];
    expect(suggest(rx(), history, { week: 9, key: 'deload' })).toEqual({
      weights: [35, 30, 25],
      hintKey: 'suggest.deload',
    });
  });

  it('rule 5: deload without history still starts from the start weight', () => {
    expect(suggest(rx(), [], { week: 9, key: 'deload' }).hintKey).toBe('suggest.start');
  });
});
