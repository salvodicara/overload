import { expect, it } from 'vitest';
import { diffRoutineSession } from '../routineDiff';
import type { ActiveSession } from '../session';
import type { Routine } from '../types';

const routine: Routine = {
  id: 'r', name: 'Day', updatedAt: 0,
  exercises: [
    { exerciseId: 'a', occurrenceId: 'a1', sets: 2, repMin: 6, repMax: 8, restSec: 90 },
    { exerciseId: 'b', occurrenceId: 'b1', sets: 2, repMin: 8, repMax: 10, restSec: 60 },
  ],
};

it('captures structural order, additions, removals, rest, and set count', () => {
  const active: ActiveSession = {
    routineId: 'r', startTs: 0,
    ex: [
      { exerciseId: 'b', instanceId: 'b1', routineOccurrenceId: 'b1', tracking: 'weight_reps', hintKey: 'x', restOverride: 75, sets: [{ weightKg: 1, reps: 1, durationSec: null, kind: 'working', done: true }] },
      { exerciseId: 'c', instanceId: 'c1', tracking: 'reps', hintKey: 'x', sets: [{ weightKg: null, reps: 8, durationSec: null, kind: 'working', done: true }] },
    ],
  };
  const diff = diffRoutineSession(routine, active);
  expect(diff.changes).toEqual(expect.arrayContaining(['remove', 'add', 'move', 'rest', 'sets']));
  expect(diff.nextRoutine.exercises.map((exercise) => exercise.exerciseId)).toEqual(['b', 'c']);
  expect(diff.nextRoutine.exercises[0]).toMatchObject({ restSec: 75, sets: 1 });
});
