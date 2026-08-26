import { suggest } from './progression';
import {
  kindOf,
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
  instanceId?: string;
  routineOccurrenceId?: string;
  tracking: TrackingType;
  sets: ActiveSet[];
  hintKey: string;
  restOverride?: number;
  sessionNote?: string;
};

export type ActiveSession = {
  routineId: string;
  startTs: number;
  ex: ActiveExercise[];
  restUntil?: number | null;
  restExerciseId?: string | null;
  restTotalSec?: number | null;
  pausedAt?: number;
  pausedTotalMs?: number;
};

export type PersistedActiveSession = Omit<ActiveSession, 'ex'> & {
  ex: (Omit<ActiveExercise, 'tracking' | 'sets' | 'instanceId'> & {
    instanceId?: string;
    tracking?: TrackingType;
    sets: (Omit<ActiveSet, 'durationSec' | 'kind'> & {
      durationSec?: number | null;
      kind?: SetKind;
    })[];
  })[];
};

export function normalizeActiveSession(active: PersistedActiveSession): ActiveSession {
  return {
    ...active,
    ex: active.ex.map((exercise, index) => ({
      ...exercise,
      instanceId: exercise.instanceId ?? `legacy:${active.routineId}:${index}:${exercise.exerciseId}`,
      tracking: trackingOf(exercise.tracking),
      sets: exercise.sets.map((set) => ({
        ...set,
        durationSec: set.durationSec ?? null,
        kind: kindOf(set.kind),
      })),
    })),
  };
}

function activeSet(
  tracking: TrackingType,
  kind: SetKind,
  target: { weightKg?: number | null; reps?: number; durationSec?: number },
): ActiveSet {
  return {
    weightKg: tracking === 'weight_reps' ? (target.weightKg ?? null) : null,
    reps: tracking === 'duration' ? null : (target.reps ?? null),
    durationSec: tracking === 'duration' ? (target.durationSec ?? null) : null,
    kind,
    done: false,
  };
}

export function buildActiveExercise(
  rx: RoutineExercise,
  history: Workout[],
  routineId?: string,
): ActiveExercise {
  const tracking = trackingOf(rx.tracking);
  const suggestion = suggest(rx, history, routineId);
  const warmups = (rx.warmupSets ?? []).map((target) => activeSet(tracking, 'warmup', target));
  const working = suggestion.weights.map((weightKg, index) => {
    const target = rx.setTargets?.[index];
    return activeSet(tracking, 'working', {
      weightKg,
      reps: tracking === 'reps' ? (target?.repMin ?? rx.repMin) : undefined,
      durationSec: tracking === 'duration' ? (target?.repMin ?? rx.repMin) : undefined,
    });
  });

  return {
    exerciseId: rx.exerciseId,
    instanceId: rx.occurrenceId ?? `ax:${crypto.randomUUID()}`,
    ...(rx.occurrenceId ? { routineOccurrenceId: rx.occurrenceId } : {}),
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
      ...(active.instanceId ? { exerciseInstanceId: active.instanceId } : {}),
      weightKg: set.weightKg ?? 0,
      reps: set.reps ?? 0,
      done: true,
      tracking: active.tracking,
      kind: set.kind,
      ...(active.tracking === 'duration' ? { durationSec: set.durationSec ?? 0 } : {}),
    }));
}
