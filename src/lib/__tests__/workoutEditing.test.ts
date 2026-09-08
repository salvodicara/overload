import { describe, expect, it } from 'vitest';
import {
  draftFromWorkout,
  removeExerciseFromDraft,
  removeSetFromDraft,
  recomputeWorkoutFacts,
  validateWorkoutDraft,
  workoutFromDraft,
} from '../workoutEditing';
import type { Workout } from '../types';

const workout: Workout = {
  id: 'old',
  date: '2026-01-01',
  startTs: Date.UTC(2026, 0, 1, 10),
  endTs: Date.UTC(2026, 0, 1, 11),
  sets: [{ exerciseId: 'press', weightKg: 50, reps: 5, done: true }],
  volumeKg: 250,
  source: 'hevy',
  updatedAt: 1,
};

describe('completed workout editing', () => {
  it.each(['2026-02-30', '2025-02-29', '', 'not-a-date'])(
    'rejects invalid calendar date %s',
    (date) => {
      expect(validateWorkoutDraft({ ...draftFromWorkout(workout), date })).toContain('date');
    },
  );
  it.each(['24:00', '12:60', '99:99', ''])('rejects invalid time %s', (startTime) => {
    expect(validateWorkoutDraft({ ...draftFromWorkout(workout), startTime })).toContain(
      'startTime',
    );
  });
  it.each([
    { weightKg: -10 },
    { weightKg: Infinity },
    { reps: -1 },
    { reps: 2.5 },
    { tracking: 'duration' as const, durationSec: 0 },
    { tracking: 'duration' as const, durationSec: NaN },
  ])('rejects invalid set values at the persistence boundary %j', (patch) => {
    const draft = { ...draftFromWorkout(workout), sets: [{ ...workout.sets[0], ...patch }] };
    expect(validateWorkoutDraft(draft)).toContain('setValues');
    expect(() => workoutFromDraft(workout, draft)).toThrow();
  });
  it('allows leap day, fractional loads and valid timed/reps sets', () => {
    const draft = {
      ...draftFromWorkout(workout),
      date: '2024-02-29',
      startTime: '23:59',
      sets: [
        { ...workout.sets[0], weightKg: 2.5 },
        { ...workout.sets[0], tracking: 'duration' as const, durationSec: 30 },
        { ...workout.sets[0], tracking: 'reps' as const, reps: 0 },
      ],
    };
    expect(validateWorkoutDraft(draft)).toEqual([]);
  });
  it('preserves identity and provenance while correcting duration', () => {
    const draft = { ...draftFromWorkout(workout), durationMin: 75 };
    expect(validateWorkoutDraft(draft)).toEqual([]);
    expect(workoutFromDraft(workout, draft, 99)).toMatchObject({
      id: 'old',
      source: 'hevy',
      durationSec: 4500,
      updatedAt: 99,
    });
  });

  it('recomputes volume and downstream PR facts chronologically', () => {
    const later: Workout = {
      ...workout,
      id: 'later',
      date: '2026-02-01',
      startTs: Date.UTC(2026, 1, 1),
      sets: [{ exerciseId: 'press', weightKg: 55, reps: 5, done: true }],
      source: 'app',
    };
    const corrected = workoutFromDraft(
      workout,
      {
        ...draftFromWorkout(workout),
        sets: [{ exerciseId: 'press', weightKg: 60, reps: 5, done: true }],
      },
      3,
    );
    const facts = recomputeWorkoutFacts([later, corrected]);
    expect(facts.find((item) => item.id === 'old')?.volumeKg).toBe(300);
    expect(facts.find((item) => item.id === 'later')?.sets[0].isPr).toBeFalsy();
  });

  it('removes the exact exercise occurrence and its attached metadata', () => {
    const first = 'rx:routine:0:press';
    const second = 'rx:routine:1:press';
    const draft = {
      ...draftFromWorkout(workout),
      sets: [
        { ...workout.sets[0], exerciseInstanceId: first },
        { ...workout.sets[0], exerciseInstanceId: second },
      ],
      exerciseNotes: [
        { exerciseId: 'press', exerciseInstanceId: first, text: 'First cue' },
        { exerciseId: 'press', exerciseInstanceId: second, text: 'Second cue' },
      ],
      exerciseOrder: [first, second],
    };

    expect(removeExerciseFromDraft(draft, first)).toMatchObject({
      sets: [{ exerciseInstanceId: second }],
      exerciseNotes: [{ exerciseInstanceId: second, text: 'Second cue' }],
      exerciseOrder: [second],
    });
  });

  it('cleans occurrence metadata when its final set is removed', () => {
    const first = 'rx:routine:0:press';
    const second = 'rx:routine:1:row';
    const draft = {
      ...draftFromWorkout(workout),
      sets: [
        { ...workout.sets[0], exerciseInstanceId: first },
        { ...workout.sets[0], exerciseId: 'row', exerciseInstanceId: second },
      ],
      exerciseNotes: [
        { exerciseId: 'press', exerciseInstanceId: first, text: 'Press cue' },
        { exerciseId: 'row', exerciseInstanceId: second, text: 'Row cue' },
      ],
      exerciseOrder: [first, second],
    };

    expect(removeSetFromDraft(draft, 0)).toMatchObject({
      sets: [{ exerciseInstanceId: second }],
      exerciseNotes: [{ exerciseInstanceId: second, text: 'Row cue' }],
      exerciseOrder: [second],
    });
  });
  it('uses actual workout dates for PRs when import timestamps disagree', () => {
    const early = {
      ...workout,
      id: 'early',
      date: '2026-01-01',
      startTs: 200,
      sets: [{ exerciseId: 'press', weightKg: 50, reps: 5, done: true }],
    };
    const later = {
      ...workout,
      id: 'later',
      date: '2026-02-01',
      startTs: 100,
      sets: [{ exerciseId: 'press', weightKg: 60, reps: 5, done: true }],
    };
    const facts = recomputeWorkoutFacts([early, later]);
    expect(facts[0].id).toBe('later');
    expect(facts[0].sets[0].isPr).toBe(true);
  });
});

it('does not invent a PR from increasing sets within a first-ever workout', () => {
  const first = {
    ...workout,
    sets: [
      { ...workout.sets[0], weightKg: 20 },
      { ...workout.sets[0], weightKg: 30 },
    ],
  };
  expect(recomputeWorkoutFacts([first])[0].sets.map((s) => Boolean(s.isPr))).toEqual([
    false,
    false,
  ]);
});
