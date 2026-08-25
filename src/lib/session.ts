import { suggest } from './progression';
import {
  trackingOf,
  type RoutineExercise,
  type SetKind,
  type SetLog,
  type TrackingType,
  type Workout,
} from './types';

export type ActiveSet = {
  weightKg: number | null;
  reps: number | null;
  durationSec: number | null;
  kind: SetKind;
  done: boolean;
};

export type ActiveExercise = {
  exerciseId: string;
  tracking: TrackingType;
  sets: ActiveSet[];
  hintKey: string;
  restOverride?: number;
  sessionNote?: string;
};

function activeSet(
  tracking: TrackingType,
  kind: SetKind,
  target: { weightKg?: number; reps?: number; durationSec?: number },
): ActiveSet {
  return {
    weightKg: tracking === 'weight_reps' ? (target.weightKg ?? null) : null,
    reps: tracking === 'duration' ? null : (target.reps ?? null),
    durationSec: tracking === 'duration' ? (target.durationSec ?? null) : null,
    kind,
    done: false,
  };
}

export function buildActiveExercise(rx: RoutineExercise, history: Workout[]): ActiveExercise {
  const tracking = trackingOf(rx.tracking);
  const suggestion = suggest(rx, history);
  const warmups = (rx.warmupSets ?? []).map((target) => activeSet(tracking, 'warmup', target));
  const working = suggestion.weights.map((weightKg) =>
    activeSet(tracking, 'working', {
      weightKg,
      reps: tracking === 'reps' ? rx.repMin : undefined,
      durationSec: tracking === 'duration' ? rx.repMin : undefined,
    }),
  );

  return {
    exerciseId: rx.exerciseId,
    tracking,
    hintKey: suggestion.hintKey,
    sets: [...warmups, ...working],
  };
}

export function completedSets(active: ActiveExercise): SetLog[] {
  return active.sets
    .filter((set) => set.done)
    .map((set) => ({
      exerciseId: active.exerciseId,
      weightKg: set.weightKg ?? 0,
      reps: set.reps ?? 0,
      done: true,
      tracking: active.tracking,
      kind: set.kind,
      ...(active.tracking === 'duration' ? { durationSec: set.durationSec ?? 0 } : {}),
    }));
}
