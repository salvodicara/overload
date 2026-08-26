import { describe, expect, it } from 'vitest';
import { normalizeRoutineOccurrences, normalizeWorkoutOccurrences } from '../workoutOccurrences';
import type { Routine, Workout } from '../types';

describe('workout occurrence identity', () => {
  it('keeps duplicate exercises independently addressable', () => {
    const routine: Routine = {
      id: 'r',
      name: 'Duplicate day',
      updatedAt: 0,
      exercises: [
        { exerciseId: 'press', sets: 2, repMin: 6, repMax: 8, restSec: 90, note: 'heavy' },
        { exerciseId: 'press', sets: 3, repMin: 10, repMax: 12, restSec: 60, note: 'slow' },
      ],
    };
    const normalized = normalizeRoutineOccurrences(routine);
    expect(normalized.exercises.map((exercise) => exercise.occurrenceId)).toEqual([
      'rx:r:0:press',
      'rx:r:1:press',
    ]);
    expect(normalized.exercises.map((exercise) => exercise.note)).toEqual(['heavy', 'slow']);
  });

  it('assigns legacy completed sets to occurrences in exercise order', () => {
    const workout: Workout = {
      id: 'w',
      routineId: 'r',
      date: '2026-01-01',
      startTs: 1,
      endTs: 2,
      updatedAt: 2,
      source: 'app',
      volumeKg: 30,
      exerciseOrder: ['rx:r:0:press', 'rx:r:1:press'],
      sets: [
        { exerciseId: 'press', weightKg: 10, reps: 1, done: true },
        { exerciseId: 'press', weightKg: 20, reps: 1, done: true },
      ],
    };
    const normalized = normalizeWorkoutOccurrences(workout);
    expect(normalized.sets.map((set) => set.exerciseInstanceId)).toEqual([
      'rx:r:0:press',
      'rx:r:1:press',
    ]);
  });
});
