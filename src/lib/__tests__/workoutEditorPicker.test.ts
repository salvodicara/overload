import { expect, it } from 'vitest';
import { newWorkoutEditorSet } from '../../screens/WorkoutEditor';
import { validWorkoutSet } from '../workoutEditing';
it('creates a valid timed row without fake repetitions or weight', () => {
  const row = newWorkoutEditorSet('Plank', 'duration', 'instance-a');
  expect(row).toMatchObject({
    exerciseId: 'Plank',
    exerciseInstanceId: 'instance-a',
    tracking: 'duration',
    durationSec: 30,
    reps: 0,
    weightKg: 0,
  });
  expect(validWorkoutSet(row)).toBe(true);
});
it('uses the explicit goal for custom exercises and preserves distinct occurrences', () => {
  const first = newWorkoutEditorSet('custom:one', 'reps', 'instance-a');
  const second = newWorkoutEditorSet('custom:one', 'weight_reps', 'instance-b');
  expect(first).toMatchObject({ tracking: 'reps', reps: 8, weightKg: 0 });
  expect(first.durationSec).toBeUndefined();
  expect(second).toMatchObject({
    tracking: 'weight_reps',
    exerciseInstanceId: 'instance-b',
    reps: 8,
  });
  expect(validWorkoutSet(first) && validWorkoutSet(second)).toBe(true);
});
