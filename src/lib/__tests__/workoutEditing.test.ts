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
  id: 'old', date: '2026-01-01', startTs: Date.UTC(2026, 0, 1, 10), endTs: Date.UTC(2026, 0, 1, 11),
  sets: [{ exerciseId: 'press', weightKg: 50, reps: 5, done: true }],
  volumeKg: 250, source: 'hevy', updatedAt: 1,
};

describe('completed workout editing', () => {
  it('preserves identity and provenance while correcting duration', () => {
    const draft = { ...draftFromWorkout(workout), durationMin: 75 };
    expect(validateWorkoutDraft(draft)).toEqual([]);
    expect(workoutFromDraft(workout, draft, 99)).toMatchObject({
      id: 'old', source: 'hevy', durationSec: 4500, updatedAt: 99,
    });
  });

  it('recomputes volume and downstream PR facts chronologically', () => {
    const later: Workout = {
      ...workout, id: 'later', date: '2026-02-01', startTs: Date.UTC(2026, 1, 1),
      sets: [{ exerciseId: 'press', weightKg: 55, reps: 5, done: true }], source: 'app',
    };
    const corrected = workoutFromDraft(workout, { ...draftFromWorkout(workout), sets: [{ exerciseId: 'press', weightKg: 60, reps: 5, done: true }] }, 3);
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
});
