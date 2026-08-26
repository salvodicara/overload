import { describe, expect, it } from 'vitest';
import { elapsedWorkoutMs, pauseWorkout, resumeWorkout } from '../workoutTiming';
import type { ActiveSession } from '../session';

const active: ActiveSession = { routineId: 'r', startTs: 1_000, ex: [] };

describe('workout clock', () => {
  it('does not count paused time', () => {
    const paused = pauseWorkout(active, 4_000);
    expect(elapsedWorkoutMs(paused, 10_000)).toBe(3_000);
    const resumed = resumeWorkout(paused, 10_000);
    expect(elapsedWorkoutMs(resumed, 12_000)).toBe(5_000);
  });
});
