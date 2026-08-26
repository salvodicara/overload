import { describe, expect, it } from 'vitest';
import {
  addActiveExercise,
  moveActiveExercise,
  removeActiveExercise,
  replaceActiveExercise,
} from '../activeWorkout';
import type { ActiveSession } from '../session';

const session = (): ActiveSession => ({
  routineId: 'r',
  startTs: 1,
  ex: [
    { exerciseId: 'a', instanceId: 'a1', tracking: 'weight_reps', hintKey: 'x', sets: [] },
    { exerciseId: 'a', instanceId: 'a2', tracking: 'weight_reps', hintKey: 'x', sets: [] },
  ],
});

describe('active workout transformations', () => {
  it('addresses duplicate exercises by instance identity', () => {
    const removed = removeActiveExercise(session(), 'a1');
    expect(removed.ex.map((exercise) => exercise.instanceId)).toEqual(['a2']);
    const replaced = replaceActiveExercise(session(), 'a2', {
      exerciseId: 'b', instanceId: 'b1', tracking: 'reps', hintKey: 'x', sets: [],
    });
    expect(replaced.ex.map((exercise) => exercise.exerciseId)).toEqual(['a', 'b']);
  });

  it('adds and reorders without mutating the source', () => {
    const original = session();
    const added = addActiveExercise(original, {
      exerciseId: 'c', instanceId: 'c1', tracking: 'duration', hintKey: 'x', sets: [],
    });
    expect(original.ex).toHaveLength(2);
    expect(moveActiveExercise(added, 'c1', 0).ex.map((exercise) => exercise.instanceId)).toEqual([
      'c1', 'a1', 'a2',
    ]);
  });
});
