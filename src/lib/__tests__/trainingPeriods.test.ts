import { describe, expect, it } from 'vitest';
import { periodBounds, periodBuckets, periodSummary, shiftPeriod } from '../trainingPeriods';
import type { Workout } from '../types';

function workout(id: string, date: string, sets: Workout['sets'], durationMin = 60): Workout {
  return {
    id,
    date,
    startTs: 1_000,
    endTs: 1_000 + durationMin * 60_000,
    sets,
    volumeKg: 0,
    updatedAt: 1,
    source: 'app',
  };
}

describe('training periods', () => {
  it('uses Monday weeks and shifts calendar periods without date drift', () => {
    const anchor = new Date('2026-08-26T12:00:00');

    expect(periodBounds(anchor, 'week')).toEqual({ start: '2026-08-24', end: '2026-08-30' });
    expect(periodBounds(anchor, 'month')).toEqual({ start: '2026-08-01', end: '2026-08-31' });
    expect(periodBounds(anchor, 'year')).toEqual({ start: '2026-01-01', end: '2026-12-31' });
    expect(periodBounds(shiftPeriod(anchor, 'month', -1), 'month')).toEqual({
      start: '2026-07-01',
      end: '2026-07-31',
    });
  });

  it('counts only completed working sets and compares the preceding equivalent period', () => {
    const weighted = workout(
      'current',
      '2026-08-25',
      [
        { exerciseId: 'squat', weightKg: 100, reps: 5, done: true },
        { exerciseId: 'squat', weightKg: 100, reps: 5, done: true },
        { exerciseId: 'squat', weightKg: 40, reps: 8, done: true, kind: 'warmup' },
        { exerciseId: 'squat', weightKg: 100, reps: 5, done: false },
      ],
      75,
    );
    const previous = workout(
      'previous',
      '2026-08-18',
      [{ exerciseId: 'squat', weightKg: 80, reps: 5, done: true }],
      45,
    );
    const empty = workout('empty', '2026-08-26', [], 20);

    expect(
      periodSummary(new Date('2026-08-26T12:00:00'), 'week', [weighted, previous, empty]),
    ).toEqual({
      workouts: 1,
      workingSets: 2,
      volume: 1_000,
      durationMin: 75,
      previous: { workouts: 1, workingSets: 1, volume: 400, durationMin: 45 },
    });
  });

  it('returns daily, weekly and monthly trend buckets for week, month and year', () => {
    const rows = [
      workout('a', '2026-08-01', [{ exerciseId: 'x', weightKg: 10, reps: 10, done: true }]),
      workout('b', '2026-08-08', [{ exerciseId: 'x', weightKg: 20, reps: 10, done: true }]),
      workout('c', '2026-12-15', [{ exerciseId: 'x', weightKg: 30, reps: 10, done: true }]),
    ];

    expect(periodBuckets(new Date('2026-08-05T12:00:00'), 'week', rows)).toHaveLength(7);
    expect(periodBuckets(new Date('2026-08-05T12:00:00'), 'month', rows)).toMatchObject([
      { date: '2026-08-01', workouts: 1, volume: 100 },
      { date: '2026-08-08', workouts: 1, volume: 200 },
      { date: '2026-08-15', workouts: 0, volume: 0 },
      { date: '2026-08-22', workouts: 0, volume: 0 },
      { date: '2026-08-29', workouts: 0, volume: 0 },
    ]);
    expect(periodBuckets(new Date('2026-08-05T12:00:00'), 'year', rows)).toHaveLength(12);
    expect(periodBuckets(new Date('2026-08-05T12:00:00'), 'year', rows)[7]).toMatchObject({
      date: '2026-08-01',
      workouts: 2,
      volume: 300,
    });
  });
});
