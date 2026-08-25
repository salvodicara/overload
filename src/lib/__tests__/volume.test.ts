import { describe, expect, it } from 'vitest';
import { computeVolume, flagPrs, maxWeightBefore } from '../volume';
import type { SetLog, Workout } from '../types';

function set(exerciseId: string, weightKg: number, reps: number, done = true): SetLog {
  return { exerciseId, weightKg, reps, done };
}

function workout(id: string, date: string, sets: SetLog[], startTs = 0): Workout {
  return {
    id,
    date,
    startTs,
    sets,
    volumeKg: computeVolume(sets),
    updatedAt: startTs,
    source: 'app',
  };
}

describe('computeVolume', () => {
  it('sums weight x reps of done sets only', () => {
    const sets = [set('bench', 20, 10), set('bench', 30, 5), set('bench', 99, 9, false)];
    expect(computeVolume(sets)).toBe(350);
  });

  it('is 0 for no sets', () => {
    expect(computeVolume([])).toBe(0);
  });

  it('is 0 when nothing is done', () => {
    expect(computeVolume([set('bench', 50, 5, false)])).toBe(0);
  });

  it('excludes warm-up and duration sets from weight volume', () => {
    const sets: SetLog[] = [
      { exerciseId: 'squat', weightKg: 20, reps: 10, done: true, kind: 'warmup' },
      { exerciseId: 'squat', weightKg: 60, reps: 5, done: true, kind: 'working' },
      { exerciseId: 'plank', weightKg: 0, reps: 0, durationSec: 60, tracking: 'duration', done: true },
    ];

    expect(computeVolume(sets)).toBe(300);
  });
});

describe('maxWeightBefore', () => {
  const history: Workout[] = [
    workout('w1', '2026-06-01', [set('bench', 40, 8), set('bench', 50, 5)]),
    workout('w2', '2026-06-08', [set('bench', 60, 3, false), set('squat', 80, 5)]),
    workout('w3', '2026-06-15', [set('bench', 70, 3)]),
  ];

  it('returns 0 when there is no history for the exercise', () => {
    expect(maxWeightBefore(history, 'deadlift', '2026-06-20')).toBe(0);
  });

  it('returns 0 when history is empty', () => {
    expect(maxWeightBefore([], 'bench', '2026-06-20')).toBe(0);
  });

  it('takes the max done-set weight strictly before the given date', () => {
    expect(maxWeightBefore(history, 'bench', '2026-06-15')).toBe(50);
    expect(maxWeightBefore(history, 'bench', '2026-06-16')).toBe(70);
  });

  it('ignores sets that were not done', () => {
    expect(maxWeightBefore(history, 'bench', '2026-06-09')).toBe(50);
  });

  it('ignores warm-up rows when finding the historical maximum', () => {
    const withWarmup = [workout('w4', '2026-06-20', [
      { ...set('bench', 100, 1), kind: 'warmup' },
      { ...set('bench', 60, 5), kind: 'working' },
    ])];

    expect(maxWeightBefore(withWarmup, 'bench', '2026-06-21')).toBe(60);
  });
});

describe('flagPrs', () => {
  const history: Workout[] = [workout('w1', '2026-06-01', [set('bench', 50, 5)])];

  it('flags done sets above the historical max', () => {
    const sets = [set('bench', 50, 5), set('bench', 55, 3)];
    const flagged = flagPrs(sets, history, '2026-06-08');
    expect(flagged[0].isPr).toBeUndefined();
    expect(flagged[1].isPr).toBe(true);
  });

  it('does not flag anything when there is no history', () => {
    const sets = [set('bench', 100, 1)];
    const flagged = flagPrs(sets, [], '2026-06-08');
    expect(flagged[0].isPr).toBeUndefined();
  });

  it('does not flag sets that were not done', () => {
    const sets = [set('bench', 90, 1, false)];
    expect(flagPrs(sets, history, '2026-06-08')[0].isPr).toBeUndefined();
  });

  it('does not mutate the input sets', () => {
    const sets = [set('bench', 60, 3)];
    const flagged = flagPrs(sets, history, '2026-06-08');
    expect(flagged).not.toBe(sets);
    expect(sets[0].isPr).toBeUndefined();
    expect(flagged[0].isPr).toBe(true);
  });

  it('ignores workouts on or after the given date', () => {
    const withFuture = [...history, workout('w2', '2026-06-08', [set('bench', 200, 1)])];
    expect(flagPrs([set('bench', 60, 3)], withFuture, '2026-06-08')[0].isPr).toBe(true);
  });

  it('does not treat warm-up rows as personal records', () => {
    const warmup = [{ ...set('bench', 60, 3), kind: 'warmup' }];

    expect(flagPrs(warmup, history, '2026-06-08')[0].isPr).toBeUndefined();
  });
});
