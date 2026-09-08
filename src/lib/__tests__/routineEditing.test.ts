import { expect, it } from 'vitest';
import { routineDraftValid, changeRoutineTracking } from '../routineEditing';
import type { Routine } from '../types';
const routine: Routine = {
  id: 'r',
  name: 'Routine',
  updatedAt: 0,
  exercises: [
    {
      exerciseId: 'e',
      sets: 2,
      repMin: 8,
      repMax: 12,
      restSec: 90,
      warmupSets: [{ weightKg: 20, reps: 5 }],
    },
  ],
};
it('rejects invalid autosave targets while allowing an empty draft routine', () => {
  expect(routineDraftValid({ ...routine, exercises: [] })).toBe(true);
  for (const patch of [
    { sets: -1 },
    { sets: 2.5 },
    { repMax: 2 },
    { startWeightKg: -1 },
    { incrementKg: NaN },
    { warmupSets: [{ reps: 0, weightKg: 10 }] },
  ])
    expect(
      routineDraftValid({ ...routine, exercises: [{ ...routine.exercises[0], ...patch }] }),
    ).toBe(false);
});
it('converts warmups and removes weight-only fields when switching goal', () => {
  const exercise = {
    ...routine.exercises[0],
    startWeightKg: 20,
    incrementKg: 2.5,
    setTargets: [
      { repMin: 8, repMax: 12, startWeightKg: 20 },
      { repMin: 5, repMax: 5, startWeightKg: 30 },
    ],
  };
  const timed = changeRoutineTracking(exercise, 'duration');
  expect(timed.warmupSets).toEqual([{ durationSec: 5 }]);
  expect(timed.startWeightKg).toBeUndefined();
  expect(timed.setTargets?.[0].startWeightKg).toBeUndefined();
  expect(routineDraftValid({ ...routine, exercises: [timed] })).toBe(true);
});
