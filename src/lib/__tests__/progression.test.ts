import { describe, expect, it } from 'vitest';
import { previousSets } from '../format';
import { suggest } from '../progression';
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

describe('suggest', () => {
  it('rule 1: no history falls back to the start weight', () => {
    const s = suggest(rx(), []);
    expect(s).toEqual({ weights: [20, 20, 20], hintKey: 'suggest.start' });
  });

  it('rule 1: no start weight means zeroes', () => {
    const s = suggest(rx({ startWeightKg: undefined }), []);
    expect(s).toEqual({ weights: [0, 0, 0], hintKey: 'suggest.start' });
  });

  it('rule 1: workouts without done sets of the exercise do not count as history', () => {
    const history = [workout('w1', '2026-06-01', [set(40, 10, false), set(60, 10, true, 'squat')])];
    expect(suggest(rx(), history).hintKey).toBe('suggest.start');
  });

  it('rule 2: increases every set when the top of the rep range was closed', () => {
    const history = [workout('w1', '2026-06-01', [set(40, 10), set(40, 10), set(37.5, 10)])];
    expect(suggest(rx(), history)).toEqual({
      weights: [42.5, 42.5, 40],
      hintKey: 'suggest.increase',
    });
  });

  it('rule 2: uses the exercise increment when given', () => {
    const history = [workout('w1', '2026-06-01', [set(60, 10), set(60, 10), set(60, 10)])];
    expect(suggest(rx({ incrementKg: 5 }), history).weights).toEqual([65, 65, 65]);
  });

  it('rule 3: repeats the same weights when the range was not closed', () => {
    const history = [workout('w1', '2026-06-01', [set(40, 10), set(40, 9), set(40, 8)])];
    expect(suggest(rx(), history)).toEqual({
      weights: [40, 40, 40],
      hintKey: 'suggest.repeat',
    });
  });

  it('rule 3: an open-ended rep range never triggers an increase', () => {
    const history = [workout('w1', '2026-06-01', [set(40, 30), set(40, 30), set(40, 30)])];
    expect(suggest(rx({ repMax: null }), history).hintKey).toBe('suggest.repeat');
  });

  it('uses the most recent workout, tie-broken by startTs', () => {
    const history = [
      workout('w1', '2026-06-01', [set(30, 8), set(30, 8), set(30, 8)]),
      workout('w2', '2026-06-08', [set(40, 8), set(40, 8), set(40, 8)], { startTs: 100 }),
      workout('w3', '2026-06-08', [set(50, 8), set(50, 8), set(50, 8)], { startTs: 200 }),
    ];
    expect(suggest(rx(), history).weights).toEqual([50, 50, 50]);
  });

  it('pads and truncates the last weights to the routine set count', () => {
    const history = [workout('w1', '2026-06-01', [set(40, 8), set(45, 8)])];
    expect(suggest(rx({ sets: 4 }), history).weights).toEqual([40, 45, 45, 45]);
    expect(suggest(rx({ sets: 1 }), history).weights).toEqual([40]);
  });

  it('does not use warm-up rows for progression', () => {
    const history = [workout('w1', '2026-06-01', [
      { ...set(20, 10), kind: 'warmup' },
      { ...set(40, 8), kind: 'working' },
      { ...set(40, 8), kind: 'working' },
      { ...set(40, 8), kind: 'working' },
    ])];

    expect(suggest(rx(), history).weights).toEqual([40, 40, 40]);
  });
});

describe('previousSets', () => {
  it('returns completed working rows from the latest workout in saved order', () => {
    const history = [
      workout('w1', '2026-06-01', [set(30, 8)]),
      workout('w2', '2026-06-08', [
        { ...set(20, 10), kind: 'warmup' },
        { ...set(40, 8), kind: 'working' },
        { ...set(50, 5), kind: 'working' },
      ]),
    ];
    expect(previousSets(history, BENCH)).toEqual([
      { ...set(40, 8), kind: 'working' },
      { ...set(50, 5), kind: 'working' },
    ]);
  });
});
